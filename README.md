# CloudCheck Code Running Server

This Cloud Check server can run code in various different programming languages. You can supply the programs as part of a JSON object. The server then starts a separate process to run the code and return the result.

# Installation

After retrieving the code from this repository, you can install the dependencies of the server using the following command (make sure you have Node.js installed on your machine):

```
npm install
```

# Running the server locally

You can start the server locally using the following command:

```
npm start
```

This will start the server on port 2700.

Note that the server relies on a bunch of different compilers and interpreters to run the code. If you haven't installed these on your local machinage, you'll run into issues.

A better way to run the server locally is to use the Docker container instead, which also installs the tools needed to run code on the server.

# Running the server using the supplied Docker image

Here's how to build and run the Cloudcheck server using the Docker image:

```
export PORT=80
docker build . -t cloudcheck
docker run -p $PORT:2700 cloudcheck
```

# How to run code

You can request to run code by doing a POST request to the root of the server. At the moment, the server can run code retrieved either from a separate Git repository, or it can run a sequence of unit tests. We're currently revising the API for this, more details will be added here soon.
