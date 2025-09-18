#!/bin/bash

# Define variables
DOCKERFILE_PATH="containers/Dockerfile"
IMAGE_NAME="coral-ssh-slurm"
TAG="tag"
SSH_KEY_PATH="/home/your-username/.ssh/your-public-key"
CONTAINER_NAME="coral-ssh-slurm"
HOSTNAME="slurmnode1"
PORT_MAPPING="2222:22"

# Stop and remove the existing container if it exists
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "Stopping and removing existing container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# Remove the existing image if it exists
if [ "$(docker images -q $IMAGE_NAME:$TAG)" ]; then
    echo "Removing existing image..."
    docker rmi $IMAGE_NAME:$TAG
fi

# Build the Docker image
echo "Building the Docker image..."
docker build -f "$DOCKERFILE_PATH" -t "$IMAGE_NAME:$TAG" --secret id=ssh-key,src="$SSH_KEY_PATH" .

# Run the Docker container
echo "Running the Docker container..."
docker run -h "$HOSTNAME" -p "$PORT_MAPPING" -it --name "$CONTAINER_NAME" "$IMAGE_NAME:$TAG" bash