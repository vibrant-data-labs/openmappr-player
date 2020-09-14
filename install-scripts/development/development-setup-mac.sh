#!/bin/bash
# Tested on macOS Catalina 10.15.5

# Assign Color Variables
BLACK=0
RED=1
GREEN=2
YELLOW=3
BLUE=4
MAGENTA=5
CYAN=6
WHITE=7

# Prompt user to start setup
tput setaf $MAGENTA; read -n1 -p ">>> Press Y/y to set up OpenMappr for development > " key

# Exit if not Y/y
if [[ "$key" != "y" && "$key" != "Y" ]] ; then
  tput setaf $RED; echo ">>> Exiting! "
  tput setaf $WHITE;
  exit
fi

# Trigger a sudo call for authentication
tput setaf $MAGENTA; echo "";
echo ">>> Asking for a sudo password..."
tput setaf $YELLOW;
sudo whoami >/dev/null

sleep 2

# Install xcode command line tools
tput setaf $MAGENTA; echo ">>> xcode"
tput setaf $CYAN; echo "> Checking for xcode command line tools..."
if xcode-select -p 1>/dev/null;echo $? | grep -q "0" >/dev/null ; then
  tput setaf $GREEN; echo "> xcode is already installed!"
else
  tput setaf $CYAN; echo "> Installing xcode...";
  tput setaf $YELLOW;
  xcode-select --install
fi

# Install homebrew package manager
tput setaf $MAGENTA; echo ">>> homebrew"
tput setaf $CYAN; echo "> Checking for homebrew..."
if brew -v | grep -q "Homebrew"  >/dev/null ; then
  tput setaf $GREEN; echo "> homebrew is already installed!" &2>/dev/null
else
  tput setaf $CYAN; echo "> Installing homebrew...";
  tput setaf $YELLOW;
  ${SHELL} -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)" >/dev/null
fi

sleep 2

# Install node version manager
tput setaf $MAGENTA; echo ">>> node"
tput setaf $CYAN; echo "> Checking for node v8.12.0..."
if node -v | grep -q "v8.12.0" ; then
  tput setaf $GREEN; echo "> node v8.12.0 is already installed!"
else
  tput setaf $CYAN; echo "> Installing node version manager v0.35.3..."
  tput setaf $YELLOW;
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | ${SHELL}
  # Install node v8.12.0
  tput setaf $CYAN; echo "> Installing and switching to node v8.12.0..."
  tput setaf $YELLOW;
  nvm install 8.12.0
  nvm use 8.12.0
fi

sleep 2

# Reload system environment
tput setaf $MAGENTA; echo ">>> Reloading system environment..."
case ${SHELL} in
  "/bin/bash" )
    source ~/.bash_profile
  ;;
  "/bin/zsh" )
    source ~/.zshrc
  ;;
  *)
    source ~/.bash_profile
  ;;
esac

sleep 2

# Install and set up docker
tput setaf $MAGENTA; echo ">>> docker"
tput setaf $CYAN; echo "> Checking for docker..."
DOCKER_PATH=/Applications/Docker.app
if [ -d ${DOCKER_PATH} ] ; then
  tput setaf $GREEN; echo "> docker is already installed!"
else
  tput setaf $CYAN; echo "> Installing docker via homebrew..."
  tput setaf $YELLOW;
  brew cask install docker >/dev/null
fi

# Start docker so we can use it later
tput setaf $CYAN; echo "> Opening docker..."
tput setaf $YELLOW;
open /Applications/Docker.app

sleep 2

# Install git
tput setaf $MAGENTA; echo ">>> git"
tput setaf $CYAN; echo "> Checking for git..."
if git --version | grep -q "git version" ; then
  tput setaf $GREEN; echo "> git is already installed!"
else
  tput setaf $CYAN; echo "> Installing git via homebrew..."
  tput setaf $YELLOW;
  brew install git >/dev/null
fi

sleep 2

# Install ruby
tput setaf $MAGENTA; echo ">>> ruby"
tput setaf $CYAN; echo "> Checking for ruby..."
if ruby -v | grep -q "ruby" ; then
  tput setaf $GREEN; echo "> ruby is already installed!"
else
  tput setaf $CYAN; echo "> Installing ruby via homebrew..."
  tput setaf $YELLOW;
  brew install ruby >/dev/null
fi

# Install ruby gem: sass
tput setaf $CYAN; echo "> Checking for ruby gem: sass..."
if sass -v | grep -q "Ruby Sass" >/dev/null ; then
  tput setaf $GREEN; echo "> sass is already installed!"
else
  tput setaf $CYAN; echo "> Installing ruby gem: sass..."
  tput setaf $YELLOW;
  sudo gem install sass >/dev/null
fi

sleep 2 

# Install ruby gem: compass
tput setaf $CYAN; echo "> Checking for ruby gem: compass..."
if compass -v | grep -q "Compass"  >/dev/null ; then
  tput setaf $GREEN; echo "> compass is already installed!"
else
  tput setaf $CYAN; echo "> Installing ruby gem: compass..."
  tput setaf $YELLOW;
  sudo gem install compass >/dev/null
fi

sleep 2

# Installing yo, bower, and grunt
tput setaf $MAGENTA; echo ">>> global npm packages"
tput setaf $CYAN; echo "> Installing yo, bower, and grunt..."
tput setaf $YELLOW;
npm install -g yo bower grunt-cli >/dev/null

sleep 2

# Clone Github Repository
tput setaf $MAGENTA;
echo ">>> OpenMappr repository"
tput setaf $CYAN; echo "> Checking for existing OpenMappr files..."
if [ -d "./openmappr" ] ; then
  tput setaf $GREEN; echo "> OpenMappr is already cloned!"
  cd openmappr
else
  tput setaf $CYAN; echo "> Cloning OpenMappr repository from Github..."
  tput setaf $YELLOW;
  git clone https://github.com/selfhostedworks/openmappr.git >/dev/null
  cd openmappr
fi

sleep 2

# Install project dependencies
tput setaf $CYAN; echo "> Running npm and bower install steps..."
tput setaf $YELLOW;
npm install >/dev/null
bower install >/dev/null

# Build the application
tput setaf $CYAN; echo "> Building the application with grunt..."
tput setaf $YELLOW;
grunt >/dev/null

sleep 2

# Start the docker-compose stack
tput setaf $MAGENTA; echo ">>> docker-compose stack"
tput setaf $CYAN; echo "> Checking for an existing docker compose stack..."
if sudo docker ps -a | grep -q "openmappr_" >/dev/null ; then
  tput setaf $GREEN; echo "> The docker compose stack is already running. Let's remove it and start over..."
  tput setaf $YELLOW;
  sudo docker-compose down >/dev/null
  sudo docker-compose -f docker-compose.local.yml up -d
else
  tput setaf $CYAN; echo "> Starting local development stack via docker compose..."
  sudo docker-compose -f docker-compose.local.yml up -d
fi

sleep 2

# Start the server
tput setaf $MAGENTA; echo ">>> Running server at http://localhost:8080 ..."
  tput setaf $YELLOW;
./run_local_mode.sh

# Set default color back to white
tput setaf $WHITE;