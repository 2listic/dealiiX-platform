#!/bin/bash

# Define variables for first container
DOCKERFILE_PATH="containers/Dockerfile"
IMAGE_NAME="coral-ssh-slurm"
TAG="latest"
SSH_KEY_PATH="/home/your-username/.ssh/your-public-key"
CONTAINER_NAME="coral-ssh-slurm-bashfile"
HOSTNAME="slurm"
PORT_MAPPING="2222:22"

# Define variables for second container
VISUALIZER_DOCKERFILE_PATH="coral-visualizer/Dockerfile"
VISUALIZER_IMAGE_NAME="coral-visualizer"
VISUALIZER_TAG="latest"
VISUALIZER_CONTAINER_NAME="coral-visualizer-bashfile"
VISUALIZER_PORT_MAPPING="8080:80"

# Shared directory/volume configuration
# Option 1: Use a host directory (bind mount)
SHARED_HOST_DIR="./containers/shared-data"
SHARED_MOUNT_PATH_CORAL="/shared-data"
SHARED_MOUNT_PATH_VISUALIZER="/deploy/data"


# Option 2: Use a Docker volume (uncomment to use)
# SHARED_VOLUME_NAME="coral-shared-data"

# Stop and remove existing containers
for container in $CONTAINER_NAME $VISUALIZER_CONTAINER_NAME; do
    if [ "$(docker ps -aq -f name=$container)" ]; then
        echo "Stopping and removing container: $container..."
        docker stop $container
        docker rm $container
    fi
done

# Remove existing images
if [ "$(docker images -q $IMAGE_NAME:$TAG)" ]; then
    echo "Removing existing image: $IMAGE_NAME:$TAG..."
    docker rmi $IMAGE_NAME:$TAG
fi

if [ "$(docker images -q $VISUALIZER_IMAGE_NAME:$VISUALIZER_TAG)" ]; then
    echo "Removing existing image: $VISUALIZER_IMAGE_NAME:$VISUALIZER_TAG..."
    docker rmi $VISUALIZER_IMAGE_NAME:$VISUALIZER_TAG
fi

# Create shared directory if using bind mount
mkdir -p "$SHARED_HOST_DIR"

# Or create Docker volume if using that option
# docker volume create $SHARED_VOLUME_NAME

# Build both Docker images
echo "Building the SLURM container image..."
docker build -f "$DOCKERFILE_PATH" -t "$IMAGE_NAME:$TAG" --secret id=ssh-key,src="$SSH_KEY_PATH" .

echo "Building the visualizer container image..."
docker build -f "$VISUALIZER_DOCKERFILE_PATH" -t "$VISUALIZER_IMAGE_NAME:$VISUALIZER_TAG" coral-visualizer/

# Run the SLURM container with shared directory
echo "Running the SLURM container..."
docker run -d \
    -h "$HOSTNAME" \
    -p "$PORT_MAPPING" \
    -v "$SHARED_HOST_DIR:$SHARED_MOUNT_PATH_CORAL" \
    --name "$CONTAINER_NAME" \
    "$IMAGE_NAME:$TAG"

# Run the visualizer container with shared directory
echo "Running the visualizer container..."
docker run -d \
    -p "$VISUALIZER_PORT_MAPPING" \
    -v "$SHARED_HOST_DIR:$SHARED_MOUNT_PATH_VISUALIZER" \
    --name "$VISUALIZER_CONTAINER_NAME" \
    "$VISUALIZER_IMAGE_NAME:$VISUALIZER_TAG"

echo "Both containers are running with shared directory: $SHARED_HOST_DIR"
echo "SLURM container: $CONTAINER_NAME (SSH port: 2222)"
echo "Visualizer container: $VISUALIZER_CONTAINER_NAME (Web port: 8080)"