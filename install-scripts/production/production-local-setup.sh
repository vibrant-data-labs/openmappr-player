#!/bin/bash
#
#                 The only thing you need to install here is cURL.
#                          `sudo apt install curl -y`
#
#
#
# Assign Color Variables
BLACK=0
RED=1
GREEN=2
YELLOW=3
BLUE=4
MAGENTA=5
CYAN=6
WHITE=7

tput setaf $CYAN; read -n1 -p "Press Y/y to set up Openmappr for production >> "  key

if [[ "$key" != "y" && "$key" != "Y" ]] ; then
  tput setaf $RED; echo ">> Exiting! "
  tput setaf $WHITE;
	exit
fi

# Call sudo to have user enter their password
tput setaf $MAGENTA; echo "
>> Asking for sudo password..."
sudo whoami >/dev/null

# Get all updates (unattended)
tput setaf $MAGENTA; echo ">> Configuring apt..."
export DEBIAN_FRONTEND=noninteractive
export DEBIAN_PRIORITY=critical
tput setaf $YELLOW;
sudo -E apt-get -qy update >/dev/null
sudo -E apt-get -qy -o "Dpkg::Options::=--force-confdef" -o "Dpkg::Options::=--force-confold" upgrade >/dev/null
sudo -E apt-get -qy autoclean >/dev/null

# Remove any old versions of docker
tput setaf $MAGENTA; echo ">> Removing old docker versions..."
tput setaf $YELLOW;
sudo apt-get remove docker docker-engine docker.io containerd runc -y >/dev/null

# Update apt sources
tput setaf $MAGENTA; echo ">> Updating apt sources..."
tput setaf $YELLOW;
sudo apt-get update -qq >/dev/null

# Install docker via apt
tput setaf $MAGENTA; echo ">> Installing docker..."
tput setaf $YELLOW;
curl -sSL https://get.docker.com | sudo bash

# Start and enable the docker service
tput setaf $MAGENTA; echo ">> Setting up the docker service..."
tput setaf $YELLOW;
sudo systemctl start docker >/dev/null
sudo systemctl enable docker >/dev/null

# Install docker compose
tput setaf $MAGENTA; echo ">> Installing docker-compose..."
tput setaf $YELLOW;
sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose >/dev/null
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
tput setaf $MAGENTA; echo ">> Installing Nginx..."
tput setaf $YELLOW;
sudo add-apt-repository ppa:nginx/stable >/dev/null
sudo apt-get update >/dev/null
sudo apt-get install nginx -y >/dev/null

# Start and enable Nginx
tput setaf $MAGENTA; echo ">> Setting up the Nginx service..."
tput setaf $YELLOW;
sudo systemctl start nginx >/dev/null
sudo systemctl enable nginx >/dev/null

# Configuring ufw rules and enabling ufw service
tput setaf $MAGENTA; echo ">> Checking the status of ufw..."
if ufw status | head -1 | grep -q "inactive" ; then
  tput setaf $CYAN; echo "Adding some ufw rules and enabling the ufw service..."
  tput setaf $YELLOW;
  sudo ufw allow 'Nginx Full'
  sudo ufw allow OpenSSH
  sudo ufw enable <<EOF
y
EOF
else
  tput setaf $GREEN; echo "ufw is already enabled!"
fi

# Set Nginx self-signed certificates
tput setaf $MAGENTA; echo ">> Setting a self-signed certificate..."
tput setaf $YELLOW;
sudo openssl req -new -newkey rsa:4096 -days 3650 -nodes -x509 -subj "/C=US/ST=SelfSigned/L=Springfield/O=Dis/CN=self-signed.xyz" -keyout /etc/nginx/nginx-selfsigned.key -out /etc/nginx/nginx-selfsigned.crt >/dev/null

# Generate a strong key
tput setaf $MAGENTA; echo ">> Generating a strong Diffie Hellman key..."
tput setaf $YELLOW;
sudo openssl dhparam -out /etc/nginx/dhparam.pem 4096 >/dev/null

# Create SSL params file
tput setaf $MAGENTA; echo ">> Creating the SSL params file..."
tput setaf $YELLOW;
sudo mkdir -p /etc/nginx/snippets/ >/dev/null
sudo touch /etc/nginx/snippets/ssl-params.conf >/dev/null
cat <<'EOF' > /etc/nginx/snippets/ssl-params.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_dhparam /etc/nginx/dhparam.pem;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
ssl_ecdh_curve secp384r1; # Requires nginx >= 1.1.0
ssl_session_timeout  10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off; # Requires nginx >= 1.5.9
ssl_stapling on; # Requires nginx >= 1.3.7
ssl_stapling_verify on; # Requires nginx => 1.3.7
resolver 1.1.1.1 1.0.0.1 valid=300s;
resolver_timeout 5s;
# We use Cloudflare for strict transport.
# add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
EOF

# Create Nginx config file
tput setaf $MAGENTA; echo ">> Creating Nginx configuration file for OpenMappr..."
tput setaf $YELLOW;
cat <<'EOF' > /etc/nginx/sites-available/openmappr.conf
server {
listen 80;
listen [::]:80;
server_name @@@nginx_conf_domain@@@;
# force to https
if ($scheme = http) {
    return 301 https://$host$request_uri;  
}
}
server {
listen 443 ssl http2;
listen  [::]:443 ssl http2;
server_name @@@nginx_conf_domain@@@;
# ssl configuration
### CHANGE --- remove "ssl on;"
client_max_body_size 100M;
#ssl on;
ssl_certificate /etc/nginx/nginx-selfsigned.crt; 
ssl_certificate_key /etc/nginx/nginx-selfsigned.key;
include snippets/ssl-params.conf;
access_log /var/log/nginx/openmappr-access.log;
error_log /var/log/nginx/openmappr-error.log warn;
location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass http://127.0.0.1:8080;
}
}
EOF

# Get OpenMappr domain from user
while [[ -z "$nginx_conf_domain" ]]
do
    tput setaf $CYAN; read -p "OpenMappr Domain (example.com, *.example.com) >> " nginx_conf_domain
done
# Validate domain formatting
tput setaf $MAGENTA; echo ">> Validating domain format..."
tput setaf $YELLOW;
PATTERN="^((\*)|((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|((\*\.)?([a-zA-Z0-9-]+\.){0,5}[a-zA-Z0-9-][a-zA-Z0-9-]+\.[a-zA-Z]{2,63}?))$"
if [[ "$nginx_conf_domain" =~ $PATTERN ]]; then
	nginx_conf_domain=`echo $nginx_conf_domain | tr '[A-Z]' '[a-z]'`
# Replacing placeholder value
tput setaf $MAGENTA; echo ">> Setting Nginx domain..."
tput setaf $YELLOW;
sed -i "s/@@@nginx_conf_domain@@@/${nginx_conf_domain}/g" /etc/nginx/sites-available/openmappr.conf
else
    tput setaf $RED; echo ">> Invalid Domain!"
    tput setaf $WHITE;
    exit 1
fi
# Create a symlink
tput setaf $MAGENTA; echo ">> Creating Nginx symlink..."
tput setaf $YELLOW;
ln -s /etc/nginx/sites-available/openmappr.conf /etc/nginx/sites-enabled/openmappr.conf >/dev/null

# Restart Nginx
tput setaf $MAGENTA; echo ">> Restarting Nginx..."
tput setaf $YELLOW;
systemctl restart nginx >/dev/null

# Start Watchtower for automatic upgrades
tput setaf $MAGENTA; echo ">> Starting Watchtower docker container..."
tput setaf $YELLOW;
docker run -d --restart=always --name watchtower -v \
/var/run/docker.sock:/var/run/docker.sock containrrr/watchtower >/dev/null

# Clone Github Repository
tput setaf $MAGENTA; echo ">> Cloning Openmappr repository from Github..."
if [ -d "./openmappr" ] ; then
  tput setaf $GREEN; echo "Repository is already cloned!"
  cd openmappr
else
  tput setaf $YELLOW;
  git clone https://github.com/selfhostedworks/openmappr.git
  cd openmappr
fi

# Grab environment variables from user
tput setaf $CYAN; 
while [[ -z "$ENVIRONMENT" ]]
do
    read -p "Please enter your environment (latest,staging,etc): " ENVIRONMENT
done
while [[ -z "$EMAIL_TO" ]]
do
    read -p "Please specify the email to send feedback to >> " EMAIL_TO
done
while [[ -z "$EMAIL_FROM" ]]
do
    read -p "Please specify the sender email for feedback >> " EMAIL_FROM
done
while [[ -z "$SENDGRID_API_KEY" ]]
do
    read -p "Please enter your Sendgrid API key >> " SENDGRID_API_KEY
done
tput setaf $MAGENTA; echo ">> Setting environment variables..."
tput setaf $YELLOW;
cp .env.sample .env
sed -i "s/ENVIRONMENT=latest/ENVIRONMENT=${ENVIRONMENT}/g" .env
sed -i "s/EMAIL_TO=/EMAIL_TO=${EMAIL_TO}/g" .env
sed -i "s/EMAIL_FROM=/EMAIL_FROM=${EMAIL_FROM}/g" .env
sed -i "s/SENDGRID_API_KEY=/SENDGRID_API_KEY=${SENDGRID_API_KEY}/g" .env

# Start server
sudo docker-compose up -d

# Set default color back to white
tput setaf $WHITE;