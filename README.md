## Example
![Example](https://github.com/tufanYavas/unity-chat-sdk/blob/main/video.gif?raw=true)


# Project Setup and Installation

This guide will help you set up the necessary services and start the project.

## Prerequisites

Ensure you have Homebrew installed on your system for managing the installation of services.

### Install and Run NATS Server Cluster

To install and run a cluster of NATS servers, follow these steps:

1. Install NATS server:
    ```bash
    brew install nats-server
    ```

2. Start three NATS server instances with cluster routing:

    ```bash
    # Instance 1
    nats-server -p 4222 -cluster nats://localhost:6222 -routes nats://localhost:6223,nats://localhost:6224
    
    # Instance 2
    nats-server -p 4223 -cluster nats://localhost:6223 -routes nats://localhost:6222,nats://localhost:6224
    
    # Instance 3
    nats-server -p 4224 -cluster nats://localhost:6224 -routes nats://localhost:6222,nats://localhost:6223
    ```

### Install and Run Redis

1. Install Redis:
    ```bash
    brew install redis
    ```

2. Start the Redis service:
    ```bash
    brew services start redis
    ```

## Project Setup

### Install Dependencies

Once NATS and Redis are set up, install the project dependencies:

```bash
npm i
```

### Build the Project

To build the project, run the following commands:

```bash
npm run build
npm run start
```

### Development Mode

If you're working in a development environment, use the following command:

```bash
npm run dev
```
