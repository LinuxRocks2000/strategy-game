#include "logo.h"
#include <iostream>
#include <unistd.h>
#include <termios.h>
#include <string>


long numba = 0;
int main(){
    struct termios old_tio, new_tio;
    tcgetattr(STDIN_FILENO, &old_tio);
    new_tio = old_tio;
    new_tio.c_lflag &= ~ICANON;
    new_tio.c_lflag &= ~ECHO;
    //new_tio.c_cc[VMIN] = 0;
    new_tio.c_cc[VTIME] = 0;
    tcsetattr(STDIN_FILENO,TCSANOW,&new_tio);
    std::string curLine = "";
    while (1) {
        char c = getchar();
        if (c != EOF){
            curLine += c;
        }
        std::cout << "\r>" << curLine;
        usleep(1000);
    }
	return 0;
}
