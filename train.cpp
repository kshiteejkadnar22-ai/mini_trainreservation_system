#include <iostream>
#include <iomanip>
#include <cstring>
#include <fstream>

using namespace std;

/*
    TRAIN RESERVATION MANAGEMENT SYSTEM

    Data Structures Used:
    1. Array              -> Train and seat information
    2. Linear Search      -> Search train/passenger
    3. Selection Sort     -> Sort trains
    4. Singly Linked List -> Confirmed passengers
    5. Circular Queue     -> Waiting list
    6. Stack              -> Cancellation history

    File Handling:
    train_reservation.txt -> Stores system data permanently
*/

const int MAX_TRAINS = 22;
const int SEATS_PER_TRAIN = 15;
const int MAX_WAITING = 5;
const char FILE_NAME[] = "train_reservation.txt";


// TRAIN STRUCTURE

struct Train{
    int trainNumber;
    char trainName[40];
    char source[30];
    char destination[30];

    int totalSeats;
    int availableSeats;
};


// PASSENGER NODE - SINGLY LINKED LIST

struct Passenger{
    int pnr;
    char name[40];
    int age;
    char gender;
    int trainNumber;
    int seatNumber;

    Passenger *next;
};


// WAITING PASSENGER

struct WaitingPassenger{
    int pnr;
    char name[40];
    int age;
    char gender;
    int trainNumber;
};


// CIRCULAR QUEUE

struct WaitingQueue{
    WaitingPassenger data[MAX_WAITING];

    int front;
    int rear;
    int count;
};


// STACK NODE - CANCELLATION HISTORY

struct CancelledPassenger{
    int pnr;
    char name[40];
    int age;
    char gender;
    int trainNumber;
    int seatNumber;

    CancelledPassenger *next;
};


// GLOBAL DATA

Train trains[MAX_TRAINS] = {
    {101, "Deccan Express", "Pune", "Mumbai",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {102, "Sinhagad Express", "Pune", "Mumbai",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {103, "Sahyadri Express", "Pune", "Kolhapur",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {104, "Pragati Express", "Pune", "Mumbai",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {105, "Intercity Express", "Pune", "Nashik",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {106, "Maharashtra Express", "Pune", "Nagpur",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {107, "Pune Goa Express", "Pune", "Madgaon",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {108, "Pune Hyderabad Express", "Pune", "Hyderabad",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {109, "Pune Bengaluru Express", "Pune", "Bengaluru",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {110, "Pune Delhi Express", "Pune", "New Delhi",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {111, "Pune Chennai Express", "Pune", "Chennai",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {112, "Pune Ahmedabad Express", "Pune", "Ahmedabad",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {113, "Pune Surat Express", "Pune", "Surat",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {114, "Pune Indore Express", "Pune", "Indore",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {115, "Pune Bhopal Express", "Pune", "Bhopal",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {116, "Pune Jaipur Express", "Pune", "Jaipur",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {117, "Pune Solapur Express", "Pune", "Solapur",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {118, "Pune Belagavi Express", "Pune", "Belagavi",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {119, "Pune Vijayawada Express", "Pune", "Vijayawada",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {120, "Pune Thane Express", "Pune", "Thane",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {121, "Pune Amravati Express", "Pune", "Amravati",SEATS_PER_TRAIN, SEATS_PER_TRAIN},
    {122, "Pune Visakhapatnam Express", "Pune", "Visakhapatnam",SEATS_PER_TRAIN, SEATS_PER_TRAIN}
};


int seatStatus[MAX_TRAINS][SEATS_PER_TRAIN] = {0};


// Head of confirmed passenger linked list
Passenger *passengerHead = NULL;

// Top of cancellation stack
CancelledPassenger *cancelTop = NULL;

// Waiting queues
WaitingQueue waitingQueues[MAX_TRAINS];

// Next PNR
int nextPNR = 1001;

// FUNCTION DECLARATIONS

void initializeQueues();
void displayMenu();
void displayTrains();
int linearSearchTrain(int trainNumber);
void selectionSortTrains();
void searchTrain();
void displayAvailableSeats(int trainIndex);
void reserveTicket();
void addConfirmedPassenger(int pnr, const char name[], int age, char gender, int trainNumber,int seatNumber);
void displayConfirmedPassengers();
Passenger* searchPassenger(int pnr);
void cancelTicket();
void addToWaitingQueue(int trainIndex, int pnr, const char name[],int age,char gender,int trainNumber);
bool removeFromWaitingQueue(int trainIndex,WaitingPassenger &p);
void displayWaitingList();
void promoteWaitingPassenger(int trainIndex);
void displayCancellationHistory();
void freePassengerList();
void freeCancellationStack();
void saveData();
void loadData();


// INITIALIZE QUEUES

void initializeQueues(){
    for (int i = 0; i < MAX_TRAINS; i++){
        waitingQueues[i].front = 0;
        waitingQueues[i].rear = -1;
        waitingQueues[i].count = 0;
    }
}


// DISPLAY MENU

void displayMenu(){
    cout << "\n=============================================\n";
    cout << "       TRAIN RESERVATION MANAGEMENT SYSTEM\n";
    cout << "=============================================\n";

    cout << "1. Display All Trains\n";
    cout << "2. Search Train\n";
    cout << "3. Sort Trains\n";
    cout << "4. Display Available Seats\n";
    cout << "5. Reserve Ticket\n";
    cout << "6. Display Confirmed Passengers\n";
    cout << "7. Search Passenger by PNR\n";
    cout << "8. Cancel Ticket\n";
    cout << "9. Display Waiting List\n";
    cout << "10. Display Cancellation History\n";
    cout << "11. Exit\n";

    cout << "=============================================\n";
    cout << "Enter your choice: ";
}


// DISPLAY TRAINS

void displayTrains(){
    cout << "\n================ TRAIN DETAILS ================\n";

    cout << left
         << setw(10) << "Number"
         << setw(22) << "Train"
         << setw(15) << "Source"
         << setw(15) << "Destination"
         << setw(10) << "Available"
         << endl;

    cout << "------------------------------------------------------------\n";

    for (int i = 0; i < MAX_TRAINS; i++){
        cout << left
             << setw(10) << trains[i].trainNumber
             << setw(22) << trains[i].trainName
             << setw(15) << trains[i].source
             << setw(15) << trains[i].destination
             << setw(10) << trains[i].availableSeats
             << endl;
    }
}


// LINEAR SEARCH FOR TRAIN

int linearSearchTrain(int trainNumber){
    for (int i = 0; i < MAX_TRAINS; i++){
        if (trains[i].trainNumber == trainNumber)
            return i;
    }
    return -1;
}


// SELECTION SORT

void selectionSortTrains(){
    for (int i = 0; i < MAX_TRAINS - 1; i++){
        int minIndex = i;

        for (int j = i + 1; j < MAX_TRAINS; j++){
            if (trains[j].trainNumber <
                trains[minIndex].trainNumber){
                minIndex = j;
            }
        }

        if (minIndex != i){
            Train temp = trains[i];
            trains[i] = trains[minIndex];
            trains[minIndex] = temp;
        }
    }

    cout << "\nTrains sorted successfully using Selection Sort.\n";
}


// SEARCH TRAIN

void searchTrain(){
    int trainNumber;

    cout << "\nEnter train number: ";
    cin >> trainNumber;

    int index = linearSearchTrain(trainNumber);

    if (index == -1){
        cout << "\nTrain not found.\n";
    }
    else{
        cout << "\nTrain Found!\n";

        cout << "Train Number : "
             << trains[index].trainNumber << endl;

        cout << "Train Name   : "
             << trains[index].trainName << endl;

        cout << "Source       : "
             << trains[index].source << endl;

        cout << "Destination  : "
             << trains[index].destination << endl;

        cout << "Available    : "
             << trains[index].availableSeats << endl;
    }
}


// DISPLAY AVAILABLE SEATS

void displayAvailableSeats(int trainIndex){
    cout << "\nSeats for Train "
         << trains[trainIndex].trainNumber
         << ":\n";

    for (int i = 0; i < SEATS_PER_TRAIN; i++){
        if (seatStatus[trainIndex][i] == 0){
            cout << "[ " << i + 1
                 << " - Available ] ";
        }
        else{
            cout << "[ " << i + 1
                 << " - Reserved  ] ";
        }

        if ((i + 1) % 2 == 0){
            cout << endl;
        }
    }
}


// ADD CONFIRMED PASSENGER
// LINKED LIST INSERTION

void addConfirmedPassenger(int pnr,const char name[],int age,char gender,int trainNumber,int seatNumber){
    Passenger *newNode = new Passenger;

    newNode->pnr = pnr;

    strcpy(newNode->name, name);

    newNode->age = age;
    newNode->gender = gender;
    newNode->trainNumber = trainNumber;
    newNode->seatNumber = seatNumber;

    newNode->next = NULL;

    if (passengerHead == NULL){
        passengerHead = newNode;
    }
    else{
        Passenger *ptr = passengerHead;

        while (ptr->next != NULL)
        {
            ptr = ptr->next;
        }

        ptr->next = newNode;
    }
}


// RESERVE TICKET

void reserveTicket(){
    int trainNumber;

    cout << "\nEnter train number: ";
    cin >> trainNumber;

    int trainIndex = linearSearchTrain(trainNumber);

    if (trainIndex == -1){
        cout << "\nTrain not found.\n";
        return;
    }


    // WAITING LIST

    if (trains[trainIndex].availableSeats == 0){
        cout << "\nNo confirmed seats available.\n";

        if (waitingQueues[trainIndex].count == MAX_WAITING){
            cout << "Waiting list is also full.\n";
            return;
        }

        char choice;

        cout << "Do you want to join the waiting list? (Y/N): ";
        cin >> choice;

        if (choice == 'Y' || choice == 'y'){
            char name[40];
            int age;
            char gender;

            cout << "Enter passenger name: ";

            cin.ignore();

            cin.getline(name, 40);

            cout << "Enter age: ";
            cin >> age;

            cout << "Enter gender (M/F/O): ";
            cin >> gender;

            int pnr = nextPNR++;

            addToWaitingQueue(trainIndex,pnr,name,age,gender,trainNumber);

            saveData();

            cout << "\nPassenger added to waiting list.\n";

            cout << "Waiting PNR: "
                 << pnr << endl;
        }

        return;
    }


    // CONFIRMED TICKET

    displayAvailableSeats(trainIndex);

    int seatNumber;

    cout << "\nEnter desired seat number: ";
    cin >> seatNumber;

    if (seatNumber < 1 ||
        seatNumber > SEATS_PER_TRAIN){
        cout << "\nInvalid seat number.\n";
        return;
    }

    if (seatStatus[trainIndex][seatNumber - 1] == 1){
        cout << "\nSeat already reserved.\n";
        return;
    }

    char name[40];
    int age;
    char gender;

    cout << "Enter passenger name: ";

    cin.ignore();

    cin.getline(name, 40);

    cout << "Enter age: ";
    cin >> age;

    cout << "Enter gender (M/F/O): ";
    cin >> gender;

    int pnr = nextPNR++;

    seatStatus[trainIndex][seatNumber - 1] = 1;

    trains[trainIndex].availableSeats--;

    addConfirmedPassenger(pnr,name,age,gender,trainNumber,seatNumber);

    saveData();

    cout << "\n================================\n";
    cout << "       TICKET CONFIRMED\n";
    cout << "================================\n";

    cout << "PNR Number  : "
         << pnr << endl;

    cout << "Passenger   : "
         << name << endl;

    cout << "Train       : "
         << trains[trainIndex].trainName << endl;

    cout << "Train No.   : "
         << trainNumber << endl;

    cout << "Seat Number : "
         << seatNumber << endl;

    cout << "================================\n";
}


// DISPLAY CONFIRMED PASSENGERS

void displayConfirmedPassengers(){
    if (passengerHead == NULL){
        cout << "\nNo confirmed passengers.\n";
        return;
    }

    Passenger *ptr = passengerHead;

    cout << "\n================ CONFIRMED PASSENGERS ================\n";

    while (ptr != NULL){
        cout << "\nPNR         : " << ptr->pnr;
        cout << "\nName        : " << ptr->name;
        cout << "\nAge         : " << ptr->age;
        cout << "\nGender      : " << ptr->gender;
        cout << "\nTrain No.   : " << ptr->trainNumber;
        cout << "\nSeat Number : " << ptr->seatNumber;
        cout << "\n-------------------------------------------------------\n";
        ptr = ptr->next;
    }
}


// SEARCH PASSENGER BY PNR

Passenger* searchPassenger(int pnr){
    Passenger *ptr = passengerHead;

    while (ptr != NULL){
        if (ptr->pnr == pnr){
            return ptr;
        }

        ptr = ptr->next;
    }

    return NULL;
}


// CIRCULAR QUEUE - INSERT

void addToWaitingQueue(int trainIndex,int pnr,const char name[],int age,char gender,int trainNumber){
    WaitingQueue &q = waitingQueues[trainIndex];

    if (q.count == MAX_WAITING){
        cout << "\nWaiting queue overflow.\n";
        return;
    }

    q.rear = (q.rear + 1) % MAX_WAITING;
    q.data[q.rear].pnr = pnr;
    strcpy(q.data[q.rear].name, name);
    q.data[q.rear].age = age;
    q.data[q.rear].gender = gender;
    q.data[q.rear].trainNumber = trainNumber;
    q.count++;
}


// CIRCULAR QUEUE - DELETE

bool removeFromWaitingQueue(int trainIndex, WaitingPassenger &p){
    WaitingQueue &q =
        waitingQueues[trainIndex];

    if (q.count == 0){
        return false;
    }

    p = q.data[q.front];
    q.front =(q.front + 1) % MAX_WAITING;
    q.count--;

    return true;
}

// DISPLAY WAITING LIST

void displayWaitingList(){
    int trainNumber;

    cout << "\nEnter train number: ";
    cin >> trainNumber;

    int trainIndex =
        linearSearchTrain(trainNumber);

    if (trainIndex == -1){
        cout << "\nTrain not found.\n";
        return;
    }

    WaitingQueue &q =waitingQueues[trainIndex];

    if (q.count == 0){
        cout << "\nWaiting list is empty.\n";
        return;
    }

    cout << "\n========== WAITING LIST ==========\n";

    int index = q.front;

    for (int i = 0; i < q.count; i++){
        cout << "\nPosition : " << i + 1;
        cout << "\nPNR      : " << q.data[index].pnr;
        cout << "\nName     : " << q.data[index].name;
        cout << "\nAge      : " << q.data[index].age;
        cout << "\n---------------------------\n";
        index = (index + 1) % MAX_WAITING;
    }
}


// CANCEL TICKET

void cancelTicket(){
    int pnr;

    cout << "\nEnter PNR number to cancel: ";
    cin >> pnr;

    Passenger *ptr = passengerHead;

    Passenger *prev = NULL;

    while (ptr != NULL && ptr->pnr != pnr){
        prev = ptr;
        ptr = ptr->next;
    }

    if (ptr == NULL){
        cout << "\nPassenger not found.\n";
        return;
    }

    int trainIndex = linearSearchTrain(ptr->trainNumber);

    CancelledPassenger *newNode =new CancelledPassenger;
    newNode->pnr = ptr->pnr;
    strcpy(newNode->name, ptr->name);
    newNode->age = ptr->age;
    newNode->gender = ptr->gender;
    newNode->trainNumber = ptr->trainNumber;
    newNode->seatNumber = ptr->seatNumber;
    newNode->next = cancelTop;
    cancelTop = newNode;
    // FREE THE SEAT

    seatStatus[trainIndex][ptr->seatNumber - 1] = 0;
    trains[trainIndex].availableSeats++;

    // DELETE PASSENGER FROM LINKED LIST

    if (prev == NULL){
        passengerHead = ptr->next;
    }
    else{
        prev->next = ptr->next;
    }


    cout << "\nTicket cancelled successfully.\n";

    cout << "PNR: "
         << ptr->pnr << endl;

    delete ptr;


    // PROMOTE WAITING PASSENGER

    promoteWaitingPassenger(trainIndex);


    // SAVE UPDATED DATA

    saveData();
}


// PROMOTE WAITING PASSENGER

void promoteWaitingPassenger(int trainIndex){
    if (waitingQueues[trainIndex].count == 0){
        return;
    }

    WaitingPassenger p;

    if (!removeFromWaitingQueue(trainIndex, p)){
        return;
    }


    // FIND FIRST AVAILABLE SEAT

    int seat = -1;

    for (int i = 0; i < SEATS_PER_TRAIN; i++){
        if (seatStatus[trainIndex][i] == 0){
            seat = i;
            break;
        }
    }

    if (seat == -1){
        return;
    }

    // RESERVE SEAT

    seatStatus[trainIndex][seat] = 1;

    trains[trainIndex].availableSeats--;

    // ADD WAITING PASSENGER
    // TO CONFIRMED PASSENGER LINKED LIST

    addConfirmedPassenger(p.pnr,p.name,p.age,p.gender,p.trainNumber,seat + 1);

    cout << "\n========================================\n";
    cout << "Waiting passenger promoted to confirmed.\n";
    cout << "PNR         : " << p.pnr << endl;
    cout << "Passenger   : " << p.name << endl;
    cout << "Seat Number : " << seat + 1 << endl;
    cout << "========================================\n";
}

// DISPLAY CANCELLATION HISTORY

void displayCancellationHistory(){
    if (cancelTop == NULL){
        cout << "\nNo cancellation history.\n";
        return;
    }

    CancelledPassenger *ptr =cancelTop;

    cout << "\n========== CANCELLATION STACK ==========\n";

    while (ptr != NULL){
        cout << "\nPNR         : " << ptr->pnr;
        cout << "\nName        : " << ptr->name;
        cout << "\nTrain No.   : " << ptr->trainNumber;
        cout << "\nSeat Number : " << ptr->seatNumber;
        cout << "\n----------------------------------------\n";
        ptr = ptr->next;
    }
}

// SAVE DATA TO TXT FILE

void saveData(){
    ofstream file(FILE_NAME);

    if (!file){
        cout << "\nError: Could not open file for saving.\n";
        return;
    }
    // SAVE NEXT PNR

    file << "N|" << nextPNR << endl;
    // SAVE CONFIRMED PASSENGERS

    Passenger *p = passengerHead;

    while (p != NULL){
        file << "C|"<< p->pnr << "|"<< p->name << "|"<< p->age << "|"<< p->gender << "|"<< p->trainNumber << "|"<< p->seatNumber<< endl;
        p = p->next;
    }

    // SAVE WAITING PASSENGERS

    for (int i = 0; i < MAX_TRAINS; i++){
        WaitingQueue &q = waitingQueues[i];

        int index = q.front;

        for (int j = 0; j < q.count; j++){
            file << "W|"<< q.data[index].pnr << "|"<< q.data[index].name << "|"<< q.data[index].age << "|"<< q.data[index].gender << "|"<< q.data[index].trainNumber<< endl;
            index = (index + 1) % MAX_WAITING;
        }
    }

    // SAVE CANCELLATION STACK

    CancelledPassenger *c = cancelTop;

    while (c != NULL){
        file << "X|"<< c->pnr << "|"<< c->name << "|"<< c->age << "|"<< c->gender << "|"<< c->trainNumber << "|"<< c->seatNumber<< endl;
        c = c->next;
    }
    file.close();
}

// LOAD DATA FROM TXT FILE

void loadData(){
    ifstream file(FILE_NAME);

    if (!file){
        return;
    }

    char type;

    while (file >> type){
        if (type == 'N'){
            char separator;
            int value;

            file >> separator >> value;

            if (value >= 1001){
                nextPNR = value;
            }
        }


        else if (type == 'C'){
            char separator;

            int pnr;
            char name[40];
            int age;
            char gender;
            int trainNumber;
            int seatNumber;


            file >> separator;
            file >> pnr;
            file >> separator;
            file.getline(name, 40, '|');
            file >> age;
            file >> separator;
            file >> gender;
            file >> separator;
            file >> trainNumber;
            file >> separator;
            file >> seatNumber;

            addConfirmedPassenger(pnr,name,age,gender,trainNumber,seatNumber);

            int trainIndex =linearSearchTrain(trainNumber);

            if (trainIndex != -1 && seatNumber >= 1 &&seatNumber <= SEATS_PER_TRAIN){
                if (seatStatus[trainIndex][seatNumber - 1] == 0){
                    seatStatus[trainIndex][seatNumber - 1] = 1;
                    trains[trainIndex].availableSeats--;
                }
            }
        }

        else if (type == 'W'){
            char separator;

            int pnr;
            char name[40];
            int age;
            char gender;
            int trainNumber;


            file >> separator;
            file >> pnr;
            file >> separator;
            file.getline(name, 40, '|');
            file >> age;
            file >> separator;
            file >> gender;
            file >> separator;
            file >> trainNumber;

            int trainIndex =linearSearchTrain(trainNumber);

            if (trainIndex != -1){
                addToWaitingQueue(trainIndex,pnr,name,age,gender,trainNumber);
            }
        }

        else if (type == 'X'){
            char separator;
            int pnr;
            char name[40];
            int age;
            char gender;
            int trainNumber;
            int seatNumber;

            file >> separator;
            file >> pnr;
            file >> separator;
            file.getline(name, 40, '|');
            file >> age;
            file >> separator;
            file >> gender;
            file >> separator;
            file >> trainNumber;
            file >> separator;
            file >> seatNumber;

            // Create cancellation stack node

            CancelledPassenger *newNode = new CancelledPassenger;
            newNode->pnr = pnr;
            strcpy(newNode->name,name);

            newNode->age = age;
            newNode->gender = gender;
            newNode->trainNumber = trainNumber;
            newNode->seatNumber = seatNumber;
            newNode->next = NULL;

            // Add at bottom to preserve
            // saved cancellation order

            if (cancelTop == NULL){
                cancelTop = newNode;
            }
            else{
                CancelledPassenger *ptr =cancelTop;

                while (ptr->next != NULL){
                    ptr = ptr->next;
                }
                ptr->next = newNode;
            }
        }
        file.ignore(1000, '\n');
    }
    file.close();
    cout << "\nPrevious reservation data loaded successfully.\n";
}

// FREE PASSENGER LINKED LIST

void freePassengerList(){
    Passenger *ptr = passengerHead;

    while (ptr != NULL){
        Passenger *temp = ptr;
        ptr = ptr->next;
        delete temp;
    }
    passengerHead = NULL;
}

// FREE CANCELLATION STACK

void freeCancellationStack(){
    CancelledPassenger *ptr =cancelTop;

    while (ptr != NULL){
        CancelledPassenger *temp =ptr;
        ptr = ptr->next;
        delete temp;
    }
    cancelTop = NULL;
}

// MAIN FUNCTION

int main(){
    initializeQueues();

    // Load previously stored data
    loadData();

    int choice;
    do{
        displayMenu();
        cin >> choice;

        switch (choice){
            case 1:
                displayTrains();
                break;
            case 2:
                searchTrain();
                break;
            case 3:
                selectionSortTrains();
                displayTrains();
                break;
            case 4:{
                int trainNumber;
                cout << "\nEnter train number: ";
                cin >> trainNumber;
                int index =linearSearchTrain(trainNumber);

                if (index == -1){
                    cout << "\nTrain not found.\n";
                }
                else{
                    displayAvailableSeats(
                        index
                    );
                }
                break;
            }
            case 5:
                reserveTicket();
                break;
            case 6:
                displayConfirmedPassengers();
                break;
            case 7:{
                int pnr;

                cout << "\nEnter PNR: ";
                cin >> pnr;

                Passenger *p = searchPassenger(pnr);

                if (p == NULL){
                    cout << "\nPassenger not found.\n";
                }
                else{
                    cout << "\n========== PNR STATUS ==========\n";
                    cout << "PNR         : " << p->pnr << endl;
                    cout << "Name        : " << p->name << endl;
                    cout << "Age         : " << p->age << endl;
                    cout << "Gender      : " << p->gender << endl;
                    cout << "Train No.   : " << p->trainNumber << endl;
                    cout << "Seat Number : " << p->seatNumber << endl;
                    cout << "Status      : CONFIRMED\n";
                }
                break;
            }
            case 8:
                cancelTicket();
                break;
            case 9:
                displayWaitingList();
                break;
            case 10:
                displayCancellationHistory();
                break;
            case 11:
                saveData();
                cout << "\nData saved successfully.\n";
                cout << "Exiting program...\n";
                break;
            default:
                cout << "\nInvalid choice.\n";
        }

    }
    while (choice != 11);

    // Release dynamically allocated memory

    freePassengerList();
    freeCancellationStack();
    return 0;
}