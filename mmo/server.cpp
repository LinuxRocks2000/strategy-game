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
#include <functional>
#define PI 3.141592
#define FPS 30
const float ALLOWED_MICROS_PER_FRAME = 1000000.f/FPS;
char* code;

unsigned int counter = 1;
unsigned int livePlayerCount = 0;
bool stratChangeMode = false;
bool playing = false;
unsigned long gameSize = 5000;
long millisPerTick = 0;
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


struct Box {
    double x1;
    double y1;
    double x2;
    double y2;

    bool check(Box other){
        return (other.x1 < x2) && (other.x2 > x1) && (other.y1 < y2) && (other.y2 > y1);
    }
};


struct Client;


struct GameObject {
    static unsigned long topId;

    unsigned long id = -1;
    double x = 0;
    double y = 0;
    float angle = 0;

    long goalX = 0;
    long goalY = 0;
    float goalAngle = 0;
    bool rm = false;

    Client* owner = NULL;
    GameObject* killer = NULL;

    std::function <void(GameObject*)> lostFunction;
    bool hasLostCallback = false;

    void setLostCallback(std::function<void(GameObject*)> function){
        lostFunction = function;
        hasLostCallback = true;
    }

    ~GameObject () {
        broadcast((std::string)"d" + std::to_string(id));
    }

    virtual void update() {

    }

    virtual Box box () {
        return { 0, 0, 0, 0 };
    }

    virtual char identify() {
        return 'g';
    }

    virtual bool editable() { // All things have the same properties: position and rotation. Not one or the other, both or neither.
        return false;
    }

    virtual void destroy() {
        rm = true;
        if (hasLostCallback){
            lostFunction(this);
        }
    }

    void shoot(float angle, float speed = 20, float dist = 20, int duration = -1);
};


class CastleObject : public GameObject {
    int lives = 3;
    void update() {

    }

    void destroy () {
        lives --;
        if (lives <= 0){
            rm = true;
            if (hasLostCallback){
                lostFunction(this);
            }
        }
    }

    Box box(){
        return { x - 25, y - 25, x + 25, y + 25 };
    }

    char identify(){
        return 'c';
    }
};


class BasicFighterObject : public GameObject {
    float xv = 0;
    float yv = 0;

    int shootTimer = 20;

    void update() {
        shootTimer --;
        if (shootTimer < 0){
            shootTimer = 30;
            shoot(angle);
        }
        double dx = goalX - x;
        double dy = goalY - y;
        if (((dx * dx) + (dy * dy)) > 10 * 10){
            angle = atan(dy/dx);
            if (dx <= 0){
                angle += PI;
            }
            xv += cos(angle) * 0.25;
            yv += sin(angle) * 0.25;
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

    Box box (){
        return { x - 10, y - 10, x + 10, y + 10 };
    }
};


class TieFighterObject : public GameObject {
    float xv = 0;
    float yv = 0;

    int shootTimer = 30;

    void update() {
        shootTimer --;
        if (shootTimer < 0){
            shootTimer = 40;
            shoot(angle);
            shoot(angle + PI);
        }
        double dx = goalX - x;
        double dy = goalY - y;
        if (((dx * dx) + (dy * dy)) > 10 * 10){
            angle = atan(dy/dx);
            if (dx <= 0){
                angle += PI;
            }
            xv += cos(angle) * 0.35;
            yv += sin(angle) * 0.35;
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
        return 't';
    }

    bool editable() {
        return true;
    }

    Box box (){
        return { x - 10, y - 10, x + 10, y + 10 };
    }
};


class SniperObject : public GameObject {
    float xv = 0;
    float yv = 0;

    int shootTimer = 60;

    void update() {
        shootTimer --;
        if (shootTimer < 0){
            shootTimer = 80; // They shoot far less often than the other guys
            shoot(angle, 25, 20, 90); // 5 faster than regular bullets, and they last 3 times longer (they're snipers)
        }
        double dx = goalX - x;
        double dy = goalY - y;
        if (((dx * dx) + (dy * dy)) > 10 * 10){
            angle = atan(dy/dx);
            if (dx <= 0){
                angle += PI;
            }
            xv += cos(angle) * 1.2;
            yv += sin(angle) * 1.2;
        }
        else {
            angle = goalAngle;
        }
        x += xv;
        y += yv;
        xv *= 0.9;
        yv *= 0.9;
        broadcast((std::string)"M" + std::to_string(id) + " " + std::to_string(x) + " " + std::to_string(y) + " " + std::to_string(angle));
    }

    char identify() {
        return 's';
    }

    bool editable() {
        return true;
    }

    Box box (){
        return { x - 10, y - 10, x + 10, y + 10 };
    }
};


class BulletObject : public GameObject {
public:
    float xv = 0;
    float yv = 0;

    int TTL = 30; // they last the same number of ticks, even if you speed up the framerate

    char identify(){
        return 'b';
    }

    void update() {
        TTL --;
        if (TTL < 0){
            rm = true;
        }
        y += yv;
        x += xv;
        broadcast((std::string)"M" + std::to_string(id) + " " + std::to_string(x) + " " + std::to_string(y) + " " + std::to_string(angle));
    }

    Box box () {
        return { x - 5, y - 5, x + 5, y + 5 };
    }
};


class WallObject : public GameObject {
    int lives = 2;
    
    char identify() {
        return 'w';
    }

    void destroy(){
        lives --;
        if (lives <= 0){
            rm = true;
            if (hasLostCallback){
                lostFunction(this);
            }
        }
    }

    int TTL = 600;

    void update() {
        TTL --;
        if (TTL < 0){
            rm = true;
        }
    }

    Box box () {
        return { x - 15, y - 15, x + 15, y + 15 };
    }
};


void addObject(GameObject* object);


std::vector <GameObject*> objects;


struct Client {
    crow::websocket::connection& conn;
    std::mutex sendMutex;
    std::mutex processingMutex; // For generic INTERNAL tasks
    bool is_authorized = false;
    bool hasPlacedCastle = false;
    CastleObject* deMoi = new CastleObject;
    std::vector <GameObject*> myFighters;
    long score = 0;

    void collect(int amount){
        score += amount;
        sendText("S" + std::to_string(score));
    }

    ~Client (){
        for (GameObject* obj : myFighters){
            obj -> owner = NULL;
            obj -> hasLostCallback = false;
        }
        if (is_authorized){
            livePlayerCount --;
        }
    }

    void sendText(std::string text){
        sendMutex.lock();
        conn.send_text(text);
        sendMutex.unlock();
    }

    void process(std::string message){ // INSIDE A CROW THREAD
        if (message == "_"){ // Heartbeat message
            return;
        }
        char command = message[0];
        std::vector<std::string> args = splitString(message.substr(1, message.size() - 1), ' ');
        processingMutex.lock();
        if (command == 'c'){
            if (args.size() && !playing){
                if (args[0] == code){
                    std::cout << "New player logged in with access code!" << std::endl;
                    sendText("s"); // SUCCESS
                    metadata();
                    is_authorized = true;
                    livePlayerCount ++;
                }
                else{
                    std::cout << "Player failed to log in - has the wrong code?" << std::endl;
                    sendText("e0"); // ERROR 0 invalid code
                }
            }
            else{
                std::cout << "A spectator entered the arena!" << std::endl;
                sendText("w0"); // WARNING 0 you are a spectator
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
                        add(deMoi);
                        fighters();
                    }
                    else{
                        std::cout << "Some idiot just tried to hack this system" << std::endl;
                    }
                }
                else if (args[0] == "w"){
                    WallObject* w = new WallObject;
                    w -> x = std::stoi(args[1]);
                    w -> y = std::stoi(args[2]);
                    add(w);
                }
                else if (args[0] == "f"){
                    if (score >= 10){
                        BasicFighterObject* f = new BasicFighterObject;
                        f -> x = std::stoi(args[1]);
                        f -> y = std::stoi(args[2]);
                        f -> goalX = f -> x;
                        f -> goalY = f -> y;
                        add(f);
                        collect(-10);
                    }
                }
                else if (args[0] == "t"){
                    if (score >= 20){
                        TieFighterObject* f = new TieFighterObject;
                        f -> x = std::stoi(args[1]);
                        f -> y = std::stoi(args[2]);
                        f -> goalX = f -> x;
                        f -> goalY = f -> y;
                        add(f);
                        collect(-20);
                    }
                }
                else if (args[0] == "s"){
                    if (score >= 30){
                        SniperObject* f = new SniperObject;
                        f -> x = std::stoi(args[1]);
                        f -> y = std::stoi(args[2]);
                        f -> goalX = f -> x;
                        f -> goalY = f -> y;
                        add(f);
                        collect(-30);
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
            sendText("e1"); // ERROR 1 premature command
        }
        processingMutex.unlock();
    }

    void metadata(){
        sendText("m" + std::to_string(gameSize) + " " + serverName);
        for (GameObject* obj : objects){
            sendObject(obj);
        }
    }

    void sendObject(GameObject* obj){
        sendText((std::string)"n" + obj -> identify() + " " + std::to_string(obj -> id) + " " + std::to_string(obj -> x) + " " + std::to_string(obj -> y) + " " + std::to_string(obj -> angle) + " " + (obj -> editable() ? "1" : "0"));
    }

    void tick(unsigned int counter, bool mode){
        sendText((std::string)"t" + std::to_string(counter) + " " + (mode ? "1" : "0"));
    }

    void lostCallback(GameObject* thing){
        long res = -1;
        for (size_t i = 0; i < myFighters.size(); i ++){
            if (myFighters[i] -> id == thing -> id){
                res = i;
            }
        }
        if (res >= 0){
            myFighters.erase(myFighters.begin() + res);
            switch (thing -> identify()){
                case 'c':
                    if (thing -> killer != NULL && thing -> killer -> owner != NULL){
                        if (thing -> killer -> owner != this){
                            thing -> killer -> owner -> collect(50); // Enemy castles are worth 50 points
                        }
                    }
                    sendText((std::string)"l");
                    is_authorized = false;
                    livePlayerCount --;
                    break;
                case 'f':
                    if (thing -> killer != NULL && thing -> killer -> owner != NULL){
                        if (thing -> killer -> owner != this){
                            thing -> killer -> owner -> collect(15); // You get 15 points for taking out an enemy fighter.
                        }
                    }
                    break;
                case 'w':
                    if (thing -> owner != NULL){
                        thing -> owner -> collect(-2); // You lose 2 points for losing a wall - nobody gains anything, though
                    }
                    break;
                case 't':
                    if (thing -> killer != NULL && thing -> killer -> owner != NULL){
                        if (thing -> killer -> owner != this){
                            thing -> killer -> owner -> collect(30); // You get 15 points for taking out an enemy tiefighter
                        }
                    }
                    break;
                case 's':
                    if (thing -> killer != NULL && thing -> killer -> owner != NULL){
                        if (thing -> killer -> owner != this){
                            thing -> killer -> owner -> collect(45); // You get 45 points for taking out an enemy sniper
                        }
                    }
                    break;
            }
        }
    }

    void add(GameObject* thing){
        addObject(thing);
        thing -> owner = this;
        thing -> setLostCallback([this](GameObject* thing){
            this -> lostCallback(thing);
        });
        myFighters.push_back(thing);
        sendText((std::string)"a" + std::to_string(thing -> id));
    }

    template <typename FighterType>
    FighterType* newFighter(unsigned long x, unsigned long y, float angle){
        FighterType* thing = new FighterType;
        thing -> x = x;
        thing -> y = y;
        thing -> goalX = x;
        thing -> goalY = y;
        thing -> angle = angle;
        thing -> goalAngle = angle;
        add(thing);
        return thing;
    }

    void newRelativeFighter(long relX, long relY, float angle = 0){
        newFighter<BasicFighterObject>(deMoi -> x + relX, deMoi -> y + relY, angle);
    }

    void newRelativeSniper(long relX, long relY, float angle = 0){
        newFighter<SniperObject>(deMoi -> x + relX, deMoi -> y + relY, angle);
    }

    void newRelativeTiefighter(long relX, long relY, float angle = 0){
        newFighter<TieFighterObject>(deMoi -> x + relX, deMoi -> y + relY, angle);
    }

    void fighters(){
        newRelativeFighter(200, 0);
        newRelativeFighter(-200, 0, PI);
        newRelativeFighter(0, 200);
        newRelativeFighter(0, -200);
        newRelativeSniper(100, 0, PI/2);
        newRelativeTiefighter(0, 100);
        newRelativeTiefighter(0, -100, PI);
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

void tick(){
    if (!playing){
        return;
    }
    if (livePlayerCount == 1){
        for (Client* cli : clients){
            if (cli -> is_authorized){
                cli -> sendText("W"); // You won the game!
            }
            else{
                cli -> sendText("E"); // The game has ended.
            }
        }
        std::cout << "\033[32mThe game ended with a winner!\033[0m" << std::endl;
        exit(0);
    }
    else if (livePlayerCount == 0){
        for (Client* cli : clients){
            cli -> sendText("T"); // The game was a tie.
        }
        std::cout << "\033[33mThe game ended with a tie.\033[0m" << std::endl;
        exit(0);
    }
    counter --;
    if (counter == 0){
        stratChangeMode = !stratChangeMode;
        if (stratChangeMode){
            counter = FPS * 30; // 20 seconds in strat change mode
        }
        else{
            counter = FPS * 20; // For every 10 seconds of play. oooh this gon' be funnnnn
        }
    }
    if (!stratChangeMode){
        for (size_t i = 0; i < objects.size(); i ++){
            GameObject* obj = objects[i];
            if (obj -> rm){
                clientListMutex.lock();
                delete obj;
                objects.erase(objects.begin() + i);
                clientListMutex.unlock();
            }
            else{
                obj -> update();
            }
        }
        for (size_t x = 0; x < objects.size() - 1; x ++){ // only go to the second-to-last, instead of the last, because the nested loop goes one above
            for (size_t y = x + 1; y < objects.size(); y ++){ // prevent double-collisions by starting this at one more than the end of the set of known complete collisions
                bool collided = false;
                if (objects[x] -> box().check(objects[y] -> box())){
                    if (objects[x] -> identify() == 'c'){
                        // If the collision root object is a castle
                        if (objects[y] -> identify() == 'b') {
                            collided = true;
                        }
                    }
                    else if (objects[x] -> identify() == 'b'){
                        // If the collision root object is a bullet
                        // bullets collide with everything.
                        collided = true;
                    }
                    else if (objects[x] -> identify() == 'w'){
                        if (objects[y] -> identify() != 'c'){
                            collided = true;
                        }
                    }
                    else{ // If it's anything else, it's a fighter.
                        if (objects[y] -> identify() != 'c'){
                            collided = true;
                        }
                    }
                }
                if (collided){
                    objects[y] -> killer = objects[x];
                    objects[x] -> killer = objects[y];
                    objects[y] -> destroy();
                    objects[x] -> destroy();
                }
            }
        }
    }
    for (Client* client : clients){
        client -> tick(counter, stratChangeMode);
    }
}

bool isPasswordChange = false;

void* interactionThread(void* _){
    while (true){
        std::string command;
        std::getline(std::cin, command);
        if (isPasswordChange){
            free(code);
            code = (char*)malloc(command.size() + 1);
            for (size_t i = 0; i < command.size(); i ++){
                code[i] = command[i];
            }
            code[command.size()] = 0;
            std::cout << "Password changed to " << code << std::endl;
            isPasswordChange = false;
        }
        else if (command == "start"){
            std::cout << "Starting game." << std::endl;
            playing = true;
        }
        else if (command == "change password"){
            isPasswordChange = true;
            std::cout << "\033[4mEnter the new passcode\033[0m" << std::endl;
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
        cli -> sendText(broadcast);
    }
}


void GameObject::shoot(float angle, float speed, float dist, int duration){
    BulletObject* bullet = new BulletObject;
    bullet -> xv = cos(angle) * speed;
    bullet -> yv = sin(angle) * speed;
    bullet -> x = x + cos(angle) * dist;
    bullet -> y = y + sin(angle) * dist;
    bullet -> owner = owner;
    if (duration != -1){
        bullet -> TTL = duration;
    }
    addObject(bullet);
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
    std::cout << "Type 'start' and press enter to begin the game." << std::endl;
    std::cout << "\033[32mSharing code: " << code << "\033[0m" << std::endl;
    pthread_t thread, interaction;
    pthread_create(&thread, NULL, mainthread, NULL);
    pthread_detach(thread);
    pthread_create(&interaction, NULL, interactionThread, NULL);
    pthread_detach(interaction);
    crow::SimpleApp webserver;
    webserver.loglevel(crow::LogLevel::Warning);
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
    webserver.port(3000).multithreaded().run();
    return 0;
}