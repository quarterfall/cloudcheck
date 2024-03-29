FROM node:16-bullseye

# Add github as a known host for SSH access
RUN mkdir ~/.ssh
RUN ssh-keyscan github.com >> ~/.ssh/known_hosts

# Create app directory
RUN mkdir -p /usr/src/app

# Copy the application files
COPY . /usr/src/app/
RUN chmod +x /usr/src/app/start.sh


# Set the working directory to be the app folder
WORKDIR /usr/src/app

# Install the node modules
RUN npm install

# Install basic dependencies from the package manager
RUN apt-get update && apt-get install -y \
    dirmngr \
    gnupg \
    apt-transport-https \
    ca-certificates \
    software-properties-common \
    gpg \
    unzip \
    default-jdk \
    maven \
    build-essential \
    python3 \
    python3-pip \
    cmake

# Install Python libraries
RUN python3 -m pip install scikit-learn pandas pandas-datareader numpy xlrd statsmodels openpyxl flake8

# Install Dotnet (needed for C# compilation)
RUN wget https://packages.microsoft.com/config/debian/11/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
RUN dpkg -i packages-microsoft-prod.deb
RUN rm packages-microsoft-prod.deb
RUN apt-get update
RUN apt-get install -y dotnet-sdk-6.0

# install Gradle (needed for Java compilation)
ENV GRADLE_VERSION=7.4
RUN curl -L https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip -o gradle-$GRADLE_VERSION-bin.zip
RUN unzip gradle-$GRADLE_VERSION-bin.zip
ENV GRADLE_HOME=/usr/src/app/gradle-$GRADLE_VERSION
ENV PATH=$PATH:$GRADLE_HOME/bin
RUN echo "org.gradle.caching=true" > $GRADLE_HOME/gradle.properties
RUN echo "org.gradle.daemon=true" >> $GRADLE_HOME/gradle.properties

#install R package
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-key '95C0FAF38DB3CCAD0C080A7BDC78B2DDEABC47B7'
RUN add-apt-repository 'deb http://cloud.r-project.org/bin/linux/debian bullseye-cran40/'
RUN apt-get update
RUN apt-get install -y r-base r-base-dev

#install Go library
RUN add-apt-repository -r ppa:longsleep/golang-backports
RUN apt-get update
RUN apt-get install -y golang-go
RUN go version

# Define and expose the port
EXPOSE $PORT

# Start the node server
CMD [ "./start.sh" ]
#CMD [ "./node_modules/.bin/ts-node", "-r", "tsconfig-paths/register", "src/index.ts" ]