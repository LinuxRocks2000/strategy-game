/*
    The structure:
    FPS times per second, the game is simulated another tick.
    Every time something changes, all the connected Clients are sent some information on what happened, such as
*/


#define CROW_ENFORCE_WS_SPEC
#include <crow.h>
#include <stdio.h>
#include <sys/time.h>
#include <unistd.h>
#include <pthread.h>
#include <vector>
#include <mutex>
#define PI 3.141592
#define FPS 30
const float ALLOWED_MICROS_PER_FRAME = 1000000.f/FPS;
char* code;

unsigned int counter = 1;
bool stratChangeMode = false;

unsigned long gameSize = 2000;
std::string serverName = "StrategyGameMMO";

void broadcast(std::string broadcast);


std::vector<std::string> splitString(std::string str, char delim){
    std::vector<std::string> ret;
    std::string buf;
    for (char c : str){
        if (c == delim){
            ret.push_back(buf);
            buf = "";
        }
        else{
            buf += c;
        }
    }
    if (buf.size() != 0){
        ret.push_back(buf);
    }
    return ret;
}


struct GameObject {
    static unsigned long topId;

    unsigned long id = -1;
    double x = 0;
    double y = 0;
    float angle = 0;

    long goalX = 0;
    long goalY = 0;
    float goalAngle = 0;

    virtual void update() {

    }

    virtual char identify() {
        return 0;
    }

    virtual bool editable() { // All things have the same properties: position and rotation. Not one or the other, both or neither.
        return false;
    }
};


class CastleObject : public GameObject {
    void update() {

    }

    char identify(){
        return 'c';
    }
};


class BasicFighterObject : public GameObject {
    float xv = 0;
    float yv = 0;

    void update() {
        double dx = goalX - x;
        double dy = goalY - y;
        if (((dx * dx) + (dy * dy)) > 10 * 10){
            angle = atan(dy/dx);
            if (dx <= 0){
                angle += PI;
            }
            xv += cos(angle) * 0.1;
            yv += sin(angle) * 0.1;
        }
        else {
            angle = goalAngle;
        }
        x += xv;
        y += yv;
        xv *= 0.95;
        yv *= 0.95;
        broadcast((std::string)"M" + std::to_string(id) + " " + std::to_string(x) + " " + std::to_string(y) + " " + std::to_string(angle));
    }

    char identify() {
        return 'f';
    }

    bool editable() {
        return true;
    }
};


void addObject(GameObject* object);


std::vector <GameObject*> objects;


struct Client {
    crow::websocket::connection& conn;
    bool is_authorized = false;
    bool hasPlacedCastle = false;
    CastleObject* deMoi = new CastleObject;
    std::vector <GameObject*> myFighters;

    ~Client (){
        
    }

    void process(std::string message){
        char command = message[0];
        std::vector<std::string> args = splitString(message.substr(1, message.size() - 1), ' ');
        if (command == 'c'){
            if (args.size()){
                if (args[0] == code){
                    std::cout << "got a valid client with code" << std::endl;
                    conn.send_text("s"); // SUCCESS
                    metadata();
                    is_authorized = true;
                }
                else{
                    std::cout << "got an invalid client with code" << std::endl;
                    conn.send_text("e0"); // ERROR 0 invalid code
                }
            }
            else{
                std::cout << "got a spectator" << std::endl;
                conn.send_text("w0"); // WARNING 0 you are a spectator
                metadata();
            }
        }
        else if (is_authorized){
            if (command == 'p'){
                if (args[0] == "c"){
                    if (!hasPlacedCastle){
                        hasPlacedCastle = true;
                        deMoi -> x = std::stoi(args[1]);
                        deMoi -> y = std::stoi(args[2]);
                        addObject(deMoi);
                        fighters();
                        conn.send_text("a" + std::to_string(deMoi -> id));
                    }
                    else{
                        std::cout << "Some idiot just tried to hack this system" << std::endl;
                    }
                }
            }
            else if (command == 'm'){
                for (GameObject* obj : myFighters){
                    if (obj -> id == std::stoi(args[0])) {
                        obj -> goalX = std::stoi(args[1]);
                        obj -> goalY = std::stoi(args[2]);
                        obj -> goalAngle = std::stod(args[3]);
                    }
                }
            }
        }
        else{
            conn.send_text("e1"); // ERROR 1 premature command
        }
    }

    void metadata(){
        conn.send_text("m" + std::to_string(gameSize) + " " + serverName);
        for (GameObject* obj : objects){
            sendObject(obj);
        }
    }

    void sendObject(GameObject* obj){
        conn.send_text((std::string)"n" + obj -> identify() + " " + std::to_string(obj -> id) + " " + std::to_string(obj -> x) + " " + std::to_string(obj -> y) + " " + std::to_string(obj -> angle) + " " + (obj -> editable() ? "1" : "0"));
    }

    void tick(unsigned int counter, bool mode){
        conn.send_text((std::string)"t" + std::to_string(counter) + " " + (mode ? "1" : "0"));
    }

    void add(GameObject* thing){
        addObject(thing);
        myFighters.push_back(thing);
        conn.send_text((std::string)"a" + std::to_string(thing -> id));
    }

    BasicFighterObject* newFighter(unsigned long x, unsigned long y){
        BasicFighterObject* thing = new BasicFighterObject;
        thing -> x = x;
        thing -> y = y;
        thing -> goalX = x;
        thing -> goalY = y;
        add(thing);
        return thing;
    }

    void newRelativeFighter(long relX, long relY){
        newFighter(deMoi -> x + relX, deMoi -> y + relY);
    }

    void fighters(){
        newRelativeFighter(200, 0);
        newRelativeFighter(-200, 0);
        newRelativeFighter(0, 200);
        newRelativeFighter(0, -200);
    }
};


std::vector <Client*> clients;
std::mutex clientListMutex;

long micros(){
    struct timeval time;
    if (gettimeofday(&time, NULL) != 0){
        perror("Gettimeofday");
    }
    return time.tv_sec * 1000000 + time.tv_usec;
}

bool playing = false;

void tick(){
    if (!playing){
        return;
    }
    counter --;
    if (counter == 0){
        stratChangeMode = !stratChangeMode;
        if (stratChangeMode){
            counter = FPS * 20; // 20 seconds in strat change mode
        }
        else{
            counter = FPS * 10; // For every 10 seconds of play. oooh this gon' be funnnnn
        }
    }
    if (!stratChangeMode){
        for (GameObject* obj : objects){
            obj -> update();
        }
    }
    for (Client* client : clients){
        client -> tick(counter, stratChangeMode);
    }
}

void* interactionThread(void* _){
    while (true){
        std::string command;
        std::getline(std::cin, command);
        if (command == "start"){
            std::cout << "Starting game." << std::endl;
            playing = true;
        }
    }
}

void* mainthread(void* _){
    double next_frame_us = micros();
    while (true){
        if (micros() > next_frame_us){
            next_frame_us += ALLOWED_MICROS_PER_FRAME;
            tick();
        }
    }
}


template <int length = 32>
char* randCode(){
    const char* characters = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#&";
    const int len = strlen(characters);
    char* ret = (char*)malloc(length);
    for (int x = 0; x < length; x ++){
        ret[x] = characters[rand() % len];
    }
    return ret;
}


void addObject(GameObject* obj){
    objects.push_back(obj);
    obj -> id = GameObject::topId;
    GameObject::topId ++;
    for (Client* cli : clients){
        cli -> sendObject(obj);
    }
}


void broadcast(std::string broadcast) {
    for (Client* cli : clients){
        cli -> conn.send_text(broadcast);
    }
}


unsigned long GameObject::topId = 0;


int main(){
    FILE* random = fopen("/dev/urandom", "r");
    srand(fgetc(random));
    fclose(random);
    std::cout << "┌───────────────────────────┐" << std::endl;
    std::cout << "│       \033[91;1mStrategy Game\033[0m       │" << std::endl;
    std::cout << "│      By Tyler Clarke      │" << std::endl;
    std::cout << "└───────────────────────────┘" << std::endl;
    code = randCode<16>();
    std::cout << "\033[32mSharing code: " << code << "\033[0m" << std::endl;
    pthread_t thread, interaction;
    pthread_create(&thread, NULL, mainthread, NULL);
    pthread_detach(thread);
    pthread_create(&interaction, NULL, interactionThread, NULL);
    pthread_detach(interaction);
    crow::SimpleApp webserver;
    //webserver.loglevel(crow::LogLevel::Warning);
    CROW_ROUTE(webserver, "/")([](const crow::request& req, crow::response& res){
        res.set_static_file_info("index.html");
        res.end();
    });
    CROW_ROUTE(webserver, "/game").websocket().onopen([](crow::websocket::connection& conn){
        clientListMutex.lock();
        clients.push_back(new Client {conn});
        clientListMutex.unlock();
    }).onmessage([](crow::websocket::connection& conn, std::string message, bool is_binary){
        for (Client* cli : clients){
            if (&cli -> conn == &conn){
                cli -> process(message);
            }
        }
    }).onclose([](crow::websocket::connection& conn, std::string reason){
        clientListMutex.lock();
        for (size_t x = 0; x < clients.size(); x ++){
            if (&clients[x] -> conn == &conn){
                delete clients[x];
                clients.erase(clients.begin() + x);
                x --;
                std::cout << "Dropped client." << std::endl;
            }
        }
        clientListMutex.unlock();
    });
    webserver.port(9160).multithreaded().run();
    return 0;
}