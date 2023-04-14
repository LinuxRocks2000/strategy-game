/* By Tyler Clarke, circa April 2023 a.d.
    The "front page" screen for MMOSG.
    If you edit, *please* don't do that thing where you strip out my name (Tyler Clarke) and put your own in.
*/


const char* STARTING_SCREEN =
"\033[91m   #######################      #######################     ##################    ##############    ##############\n"
"  ########################     ########################    ###################   ##############    ###############\n"
" #####     #####     #####    #####     #####     #####   #####          #####   #####             #####\n"
" #####     #####     #####    #####     #####     #####   #####          #####    ############     #####\n"
" #####     #####     #####    #####     #####     #####   #####          #####     ############    #####    #######\n"
" #####               #####    #####               #####   #####          #####            #####    #####      #####\n"
" #####               #####    #####               #####   ###################     #############    ################\n"
" #####               ####     #####               ####    ##################     #############     ###############\033[0m\n"
"\n"
"┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n"
"│                                                                                                                   │\n"
"│                                                                                                                   │\n"
"│                                  \033[1;91mMassively Multiplayer Online Strategy Game\033[0m                                       │\n"
"│                                                                                                                   │\n"
"│                                              \033[5;32mBy Tyler Clarke\033[0m                                                      │\n"
"│                                                                                                                   │\n"
"│       Binds an HTTP + websocket server for the game to port 3000, or whatever you specify on command-line.        │\n"
"│                                                                                                                   │\n"
"└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n"
"\n"
"\033[1;34m While also being used for broadcasting informative messages, this terminal will accept several input commands:\n"
"  • start: Lock out new arrivals (even if they get the right code,\n"
"           they will be put in Spectator mode), and begin play.\n"
"  • data: Print statistics about the currently running game.\n"
"  • change password: Change the entry password. People already logged in will not be affected.\n"
"                     After running this, you will be prompted for the new password.\033[0m\n"
"\n"
"\033[1;33m************** Tyler is looking for a job! If you need some code done, contact him at plupy44@gmail.com *************\033[0m\n";