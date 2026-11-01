-- RailwayDesk shared Supabase database setup
-- Run this script in Supabase SQL Editor after the original tables exist.
-- This is a public college-demo configuration. See the README security notes.

-- Keep a deliberately shuffled display order so the Selection Sort demo is useful.
ALTER TABLE public.trains
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

UPDATE public.trains
SET display_order = CASE train_number
  WHEN 112 THEN 1 WHEN 105 THEN 2 WHEN 120 THEN 3 WHEN 101 THEN 4
  WHEN 117 THEN 5 WHEN 109 THEN 6 WHEN 122 THEN 7 WHEN 103 THEN 8
  WHEN 115 THEN 9 WHEN 107 THEN 10 WHEN 119 THEN 11 WHEN 102 THEN 12
  WHEN 114 THEN 13 WHEN 106 THEN 14 WHEN 121 THEN 15 WHEN 110 THEN 16
  WHEN 104 THEN 17 WHEN 118 THEN 18 WHEN 108 THEN 19 WHEN 116 THEN 20
  WHEN 111 THEN 21 WHEN 113 THEN 22 ELSE 99 END;

-- Keep future PNRs at 1001 or above, without reusing existing numbers.
SELECT pg_catalog.setval(
  pg_catalog.pg_get_serial_sequence('public.reservations', 'pnr'),
  GREATEST(
    COALESCE((SELECT MAX(pnr) FROM public.reservations), 1000) + 1,
    1001
  ),
  false
);

-- Ensure direct reservation-table access remains blocked for browser roles.
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read reservations" ON public.reservations;
REVOKE ALL ON TABLE public.reservations FROM anon, authenticated;

-- Public train catalogue only (train details contain no passenger data).
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.trains TO anon, authenticated;
DROP POLICY IF EXISTS "Public can read trains" ON public.trains;
CREATE POLICY "Public can read trains"
ON public.trains FOR SELECT TO anon, authenticated USING (true);

-- Remove any broad policies for reservation records.
DROP POLICY IF EXISTS "Public can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow public read reservations" ON public.reservations;

-- One confirmed booking per train/seat.
CREATE UNIQUE INDEX IF NOT EXISTS unique_confirmed_train_seat
ON public.reservations(train_number, seat_number)
WHERE status = 'CONFIRMED';

CREATE INDEX IF NOT EXISTS waiting_queue_order
ON public.reservations(train_number, created_at, pnr)
WHERE status = 'WAITING';

-- Return the shared dashboard state. This includes passenger details for the
-- project demo, so use fictional/test passenger information only on a public site.
CREATE OR REPLACE FUNCTION public.get_system_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trains JSONB;
  v_passengers JSONB;
  v_waiting JSONB;
  v_cancellations JSONB;
  v_promoted_count INTEGER;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'trainNumber', t.train_number,
        'trainName', t.train_name,
        'source', t.source,
        'destination', t.destination,
        'totalSeats', t.total_seats,
        'availableSeats', t.total_seats - (
          SELECT COUNT(*)::INTEGER
          FROM public.reservations r
          WHERE r.train_number = t.train_number
            AND r.status = 'CONFIRMED'
        )
      ) ORDER BY t.display_order, t.train_number
    ), '[]'::JSONB
  ) INTO v_trains
  FROM public.trains t;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'pnr', r.pnr,
        'name', r.passenger_name,
        'age', r.age,
        'gender', r.gender,
        'trainNumber', r.train_number,
        'seatNumber', r.seat_number
      ) ORDER BY r.pnr
    ), '[]'::JSONB
  ) INTO v_passengers
  FROM public.reservations r
  WHERE r.status = 'CONFIRMED';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'pnr', r.pnr,
        'name', r.passenger_name,
        'age', r.age,
        'gender', r.gender,
        'trainNumber', r.train_number,
        'createdAt', r.created_at
      ) ORDER BY r.train_number, r.created_at, r.pnr
    ), '[]'::JSONB
  ) INTO v_waiting
  FROM public.reservations r
  WHERE r.status = 'WAITING';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'pnr', r.pnr,
        'name', r.passenger_name,
        'age', r.age,
        'gender', r.gender,
        'trainNumber', r.train_number,
        'seatNumber', r.seat_number,
        'cancelledAt', r.cancelled_at
      ) ORDER BY r.cancelled_at, r.pnr
    ), '[]'::JSONB
  ) INTO v_cancellations
  FROM public.reservations r
  WHERE r.status = 'CANCELLED';

  SELECT COUNT(*)::INTEGER INTO v_promoted_count
  FROM public.reservations r
  WHERE r.promoted_at IS NOT NULL;

  RETURN jsonb_build_object(
    'trains', v_trains,
    'passengers', v_passengers,
    'waiting', v_waiting,
    'cancellations', v_cancellations,
    'promotedCount', v_promoted_count
  );
END;
$$;

-- Atomic booking: lock the train row, validate the seat or enqueue the passenger.
CREATE OR REPLACE FUNCTION public.book_ticket(
  p_train_number INTEGER,
  p_passenger_name TEXT,
  p_age INTEGER,
  p_gender TEXT,
  p_seat_number INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_train public.trains%ROWTYPE;
  v_confirmed_count INTEGER;
  v_waiting_count INTEGER;
  v_pnr BIGINT;
  v_waiting_position INTEGER;
BEGIN
  IF p_passenger_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_passenger_name)) = 0 THEN
    RAISE EXCEPTION 'Passenger name is required.';
  END IF;
  IF pg_catalog.length(pg_catalog.btrim(p_passenger_name)) > 39 THEN
    RAISE EXCEPTION 'Passenger name must be 39 characters or fewer.';
  END IF;
  IF p_age IS NULL OR p_age < 1 OR p_age > 120 THEN
    RAISE EXCEPTION 'Age must be between 1 and 120.';
  END IF;
  IF p_gender IS NULL OR p_gender NOT IN ('M', 'F', 'O') THEN
    RAISE EXCEPTION 'Select a valid gender.';
  END IF;

  SELECT * INTO v_train
  FROM public.trains t
  WHERE t.train_number = p_train_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Train not found.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_confirmed_count
  FROM public.reservations r
  WHERE r.train_number = p_train_number
    AND r.status = 'CONFIRMED';

  IF v_confirmed_count >= v_train.total_seats THEN
    IF p_seat_number IS NOT NULL THEN
      RAISE EXCEPTION 'This train is full. Join the waiting list instead.';
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_waiting_count
    FROM public.reservations r
    WHERE r.train_number = p_train_number
      AND r.status = 'WAITING';

    IF v_waiting_count >= 5 THEN
      RAISE EXCEPTION 'The waiting list is full for this train.';
    END IF;

    INSERT INTO public.reservations
      (train_number, passenger_name, age, gender, seat_number, status)
    VALUES
      (p_train_number, pg_catalog.btrim(p_passenger_name), p_age, p_gender, NULL, 'WAITING')
    RETURNING pnr INTO v_pnr;

    RETURN jsonb_build_object(
      'pnr', v_pnr,
      'status', 'WAITING',
      'seat_number', NULL,
      'waiting_position', v_waiting_count + 1
    );
  END IF;

  IF p_seat_number IS NULL THEN
    RAISE EXCEPTION 'Select an available seat.';
  END IF;
  IF p_seat_number < 1 OR p_seat_number > v_train.total_seats THEN
    RAISE EXCEPTION 'Invalid seat number.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.train_number = p_train_number
      AND r.seat_number = p_seat_number
      AND r.status = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'That seat has just been booked. Refresh and select another seat.';
  END IF;

  INSERT INTO public.reservations
    (train_number, passenger_name, age, gender, seat_number, status)
  VALUES
    (p_train_number, pg_catalog.btrim(p_passenger_name), p_age, p_gender, p_seat_number, 'CONFIRMED')
  RETURNING pnr INTO v_pnr;

  RETURN jsonb_build_object(
    'pnr', v_pnr,
    'status', 'CONFIRMED',
    'seat_number', p_seat_number,
    'waiting_position', NULL
  );
END;
$$;

-- Atomic cancellation and FIFO promotion, with the released seat assigned to
-- the earliest waiting reservation for that train.
CREATE OR REPLACE FUNCTION public.cancel_ticket(p_pnr BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_train_number INTEGER;
  v_booking public.reservations%ROWTYPE;
  v_waiting public.reservations%ROWTYPE;
  v_promoted JSONB := NULL;
BEGIN
  SELECT r.train_number INTO v_train_number
  FROM public.reservations r
  WHERE r.pnr = p_pnr AND r.status = 'CONFIRMED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirmed booking not found. It may already be cancelled or waiting.';
  END IF;

  PERFORM 1 FROM public.trains t
  WHERE t.train_number = v_train_number
  FOR UPDATE;

  SELECT * INTO v_booking
  FROM public.reservations r
  WHERE r.pnr = p_pnr AND r.status = 'CONFIRMED'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This booking has already changed. Refresh and try again.';
  END IF;

  UPDATE public.reservations
  SET status = 'CANCELLED', cancelled_at = pg_catalog.now()
  WHERE pnr = p_pnr;

  SELECT * INTO v_waiting
  FROM public.reservations r
  WHERE r.train_number = v_train_number
    AND r.status = 'WAITING'
  ORDER BY r.created_at, r.pnr
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.reservations
    SET status = 'CONFIRMED',
        seat_number = v_booking.seat_number,
        promoted_at = pg_catalog.now()
    WHERE pnr = v_waiting.pnr;

    v_promoted := jsonb_build_object(
      'pnr', v_waiting.pnr,
      'name', v_waiting.passenger_name,
      'train_number', v_train_number,
      'seat_number', v_booking.seat_number
    );
  END IF;

  RETURN jsonb_build_object(
    'cancelled', jsonb_build_object(
      'pnr', v_booking.pnr,
      'name', v_booking.passenger_name,
      'train_number', v_train_number,
      'seat_number', v_booking.seat_number
    ),
    'promoted', v_promoted
  );
END;
$$;

-- Only expose the narrow functions needed by the public demo frontend.
REVOKE ALL ON FUNCTION public.get_system_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_ticket(INTEGER, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_ticket(BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_system_snapshot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_ticket(INTEGER, TEXT, INTEGER, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ticket(BIGINT) TO anon, authenticated;

-- Verify train order and initial seat capacity.
SELECT train_number, train_name, source, destination, total_seats, display_order
FROM public.trains
ORDER BY display_order, train_number;
