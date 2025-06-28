===== AVAILABLE REGIONS =====
Slug    Name                    Status  Features
----------------------------------------
ams3    Amsterdam 3             Available       Storage 
blr1    Bangalore 1             Available       Storage 
fra1    Frankfurt 1             Available       Storage 
lon1    London 1                Available       Storage 
nyc1    New York 1              Available       Storage 
nyc2    New York 2              Available       Storage 
nyc3    New York 3              Available       Storage 
sfo2    San Francisco 2         Available       Storage 
sfo3    San Francisco 3         Available       Storage 
sgp1    Singapore 1             Available       Storage 
syd1    Sydney 1                Available       Storage 
tor1    Toronto 1               Available       Storage 

Total: 12 available regions

Fetching available Digital Ocean droplet sizes...

===== AVAILABLE DROPLET SIZES =====
Slug            CPU     Memory  Disk    Price/Month
----------------------------------------

Basic Droplets:
s-1vcpu-512mb-10gb      1       512MB   10GB    $4
s-1vcpu-1gb     1       1024MB  25GB    $6
s-1vcpu-1gb-amd 1       1024MB  25GB    $7
s-1vcpu-1gb-intel       1       1024MB  25GB    $7
s-1vcpu-1gb-35gb-intel  1       1024MB  35GB    $8
s-1vcpu-2gb     1       2048MB  50GB    $12
s-1vcpu-2gb-amd 1       2048MB  50GB    $14
s-1vcpu-2gb-intel       1       2048MB  50GB    $14
s-1vcpu-2gb-70gb-intel  1       2048MB  70GB    $16
s-2vcpu-2gb     2       2048MB  60GB    $18
s-2vcpu-2gb-amd 2       2048MB  60GB    $21
s-2vcpu-2gb-intel       2       2048MB  60GB    $21
s-2vcpu-2gb-90gb-intel  2       2048MB  90GB    $24
s-2vcpu-4gb     2       4096MB  80GB    $24
s-2vcpu-4gb-amd 2       4096MB  80GB    $28
s-2vcpu-4gb-intel       2       4096MB  80GB    $28
s-2vcpu-4gb-120gb-intel 2       4096MB  120GB   $32
s-2vcpu-8gb-amd 2       8192MB  100GB   $42

CPU-Optimized Droplets:
c-2             2       4096MB  25GB    $42

Other Droplets:
c2-2vcpu-4gb    2       4096MB  50GB    $47

Total: 20 available sizes

Fetching available Digital Ocean images...

===== AVAILABLE OS IMAGES =====
Slug                    Name                    Type
----------------------------------------

AlmaLinux:
almalinux-9-x64                 AlmaLinux 9                     base
almalinux-8-x64                 AlmaLinux 8                     base

CentOS:
centos-stream-9-x64             9 Stream x64                    base

Debian:
debian-12-x64                   12 x64                          base
debian-11-x64                   11 x64                          base

Fedora:
fedora-41-x64                   41 x64                          base
fedora-40-x64                   40 x64                          base

Rocky Linux:
rockylinux-9-x64                9 x64                           base
rockylinux-8-x64                8 x64                           base

Ubuntu:
gpu-h100x8-base                 AI/ML Ready with NVLink         base
gpu-h100x1-base                 AI/ML Ready                     base
ubuntu-24-10-x64                24.10 x64                       base
ubuntu-24-04-x64                24.04 (LTS) x64                 base
ubuntu-22-04-x64                22.04 (LTS) x64                 base
ubuntu-20-04-x64                20.04 (LTS) x64                 base

Total: 15 available OS images

===== DEPLOYMENT EXAMPLE =====

# Example of using these values for droplet creation:

digitalocean.droplets.create({
  name: 'example-server',
  region: 'nyc1',                  # Choose from regions listed above
  size: 's-1vcpu-1gb',             # Choose from sizes listed above
  image: 'ubuntu-22-04-x64',       # Choose from images listed above
  ssh_keys: [YOUR_SSH_KEY_ID],
  user_data: YOUR_CLOUD_INIT_SCRIPT
});
