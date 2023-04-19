#include "terminalstuff.hpp"
#include "logo.h"
#include <iostream>
#include <unistd.h>
#include <termios.h>
#include <fcntl.h>


int main(){
    CleverTerminal prints;
    prints.init(4);
    prints.noncanonical();
    prints[0] = "[ TEST ] OK";
    prints[1] = "[ MORETEST ] WELL ITS FINE";
    prints[2] = "[ FRIGGETY FRUCK ]";
    prints[3] = "[ STUFF ] ";
    while (true){
        prints.update();
        if (prints.hasLine()){
            prints.printLn(">>> " + prints.getLine());
        }
        usleep(10000);
    }
    return 0;
}
