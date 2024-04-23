# Use an official Node.js runtime as a parent image
FROM node:20

# Set the working directory in the container to /workspace
WORKDIR /workspace

# Copy package.json and package-lock.json into the container
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm ci

# Copy the rest of your app's source code into the container
COPY . .

# Define a build-time variable for the port
ARG PORT=3000

# Make port available to the world outside this container
ENV \
    PORT=${PORT} \
    HOST=0.0.0.0
 
EXPOSE ${PORT}

# Run your app when the container launches
CMD [ "npm", "start" ]