#!/bin/bash
#
#                 The only thing you need to install here is cURL.
#                           sudo apt install curl -y
#
# Not yet tested on Fedora

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

# Update dnf sources
tput setaf $MAGENTA; echo ">>> Updating dnf sources..."
tput setaf $YELLOW;
sudo dnf update -y >/dev/null

sleep 2

# Remove any old versions of docker
tput setaf $MAGENTA; echo ">>> Removing old docker versions..."
tput setaf $YELLOW;
sudo dnf remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-selinux \
                  docker-engine-selinux \
                  docker-engine -y >/dev/null

# Install OpenMappr dependencies via dnf
tput setaf $MAGENTA; echo ">>> Installing OpenMappr dependencies..."
tput setaf $YELLOW;
sudo dnf install nodejs npm git-all python2 gcc @development-tools \
    ruby ruby-devel rubygems rubygem-sass -y >/dev/null

sleep 2

# Install ruby gem: sass
tput setaf $MAGENTA; echo ">>> Ruby gem: sass"
tput setaf $CYAN; echo "> Checking for sass..."
if sass -v | grep -q "Ruby Sass" >/dev/null ; then
  tput setaf $GREEN; echo "> sass is already installed!"
else
  tput setaf $CYAN; echo "> Installing Ruby gem: sass..."
tput setaf $YELLOW;
  sudo gem install sass >/dev/null
fi

sleep 2

# Install ruby gem: compass
tput setaf $MAGENTA; echo ">>> Ruby gem: compass"
tput setaf $CYAN; echo "> Checking for compass..."
if compass -v | grep -q "Compass" >/dev/null ; then
  tput setaf $GREEN; echo "> compass is already installed!"
else
  tput setaf $CYAN; echo "> Installing Ruby gem: compass..."
tput setaf $YELLOW;
  sudo gem install compass >/dev/null
fi

sleep 2

# Install and set up docker
tput setaf $MAGENTA; echo ">>> docker"
tput setaf $CYAN; echo "> Checking for docker..."
if docker -v | grep -q "Docker" >/dev/null ; then
  tput setaf $GREEN; echo "> docker is already installed!"
else
  # Install docker via dnf
  tput setaf $CYAN; echo "> Installing docker..."
  tput setaf $YELLOW;
  sudo dnf install dnf-plugins-core -y >/dev/null
  sudo dnf config-manager \
      --add-repo \
      https://download.docker.com/linux/fedora/docker-ce.repo >/dev/null
  sudo dnf install docker-ce docker-ce-cli containerd.io -y >/dev/null
  # Start and enable the docker service
  tput setaf $CYAN; echo "> Setting up the docker service..."
  tput setaf $YELLOW;
  sudo systemctl start docker
  sudo systemctl enable docker
fi

sleep 2

# Install docker-compose
tput setaf $MAGENTA; echo ">>> docker-compose"
tput setaf $CYAN; echo "> Checking for docker-compose..."
if docker-compose -v | grep -q "docker-compose" >/dev/null ; then
  tput setaf $GREEN; echo "> docker-compose is already installed!"
else
  tput setaf $CYAN; echo "> Installing docker-compose..."
  tput setaf $YELLOW;
  sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose >/dev/null
  sudo chmod +x /usr/local/bin/docker-compose
fi

sleep 2

# Install node version manager
tput setaf $MAGENTA; echo ">>> nvm, node, npm"
tput setaf $CYAN; echo "> Checking for node v8.12.0..."
if node -v | grep -q "v8.12.0" ; then
  tput setaf $GREEN; echo "> node v8.12.0 is already installed!"
else
  tput setaf $CYAN; echo "> Installing node version manager v0.35.3..."
  tput setaf $YELLOW;
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  # Install Node 8.12.0
  tput setaf $CYAN; echo "> Installing and switching to node v8.12.0..."
  tput setaf $YELLOW;
  nvm install 8.12.0
  nvm use 8.12.0
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