# RailwayDesk — Train Reservation Management System

A browser frontend for the C++ DSA Train Reservation Management System, connected to a shared Supabase PostgreSQL database.

## Files

- `index.html` — application UI
- `styles.css` — responsive styling
- `app.js` — Supabase connection and UI behavior
- `database_setup.sql` — database functions, access rules, and train display order

## Supabase setup

1. Open the Supabase SQL Editor.
2. Run `database_setup.sql` after the original `trains` and `reservations` tables have been created and seeded.
3. The project URL and publishable key are configured near the top of `app.js`.
4. Deploy the three frontend files (`index.html`, `styles.css`, `app.js`) to Netlify or another static host.

The frontend refreshes the shared database snapshot every five seconds and when the browser regains focus.

## Important security limitation

This version is for a college demonstration with fictional/test passenger data. The public demo functions allow anonymous visitors to book and cancel by PNR, and `get_system_snapshot()` returns passenger details needed by the demo dashboard. Do not use real passenger personal information or treat this as a production reservation service. For production, add Supabase Auth, per-user authorization, and a booking-management token or authenticated cancellation flow. Never place a Supabase secret/service-role key in frontend code. The publishable key is intended for browser use when database permissions are configured correctly.

The C++ `train.cpp` executable remains a separate implementation. This frontend currently uses Supabase database functions for shared bookings; it does not execute the C++ program.
