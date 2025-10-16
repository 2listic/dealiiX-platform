#!/bin/bash

# Default node info
export NODE_ADDR=127.0.0.1

NODE="slurmnode1"

echo "$NODE_ADDR   $NODE" >> /etc/hosts

echo "Starting services..."
service munge start
sleep 2

echo "Starting MariaDB for Slurm accounting..."
service mariadb start
sleep 2

echo "Starting slurmdbd..."
service slurmdbd start
sleep 2

echo "Starting Slurm services..."
service slurmctld start
slurmd -N $NODE
service ssh start

echo
sinfo
echo

# If no command is provided, keep container running
if [ $# -eq 0 ]; then
    echo "All services started. Keeping container alive..."
    tail -f /dev/null
else
    exec "$@"
fi
