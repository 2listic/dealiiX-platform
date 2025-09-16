#!/bin/bash

# Default node info
export NODE_ADDR=127.0.0.1

NODE="slurmnode1"

echo "$NODE_ADDR   $NODE" >> /etc/hosts

echo "Configuring munge..."
# Generate munge key if not exists
if [ ! -f /etc/munge/munge.key ]; then
    dd if=/dev/urandom of=/etc/munge/munge.key bs=1 count=1024
    chmod 400 /etc/munge/munge.key
    chown munge:munge /etc/munge/munge.key
fi

echo "Starting Slurm services..."
service munge start

# Wait for munge to be ready
sleep 2

service slurmctld start
slurmd -N $NODE
service ssh start

# Wait for services to initialize
sleep 3

echo
sinfo
echo

exec "$@"
