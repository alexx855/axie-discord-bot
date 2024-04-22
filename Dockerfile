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

# Make port 3001 available to the world outside this container
EXPOSE 3001

# Run your app when the container launches
CMD [ "npm", "start" ]