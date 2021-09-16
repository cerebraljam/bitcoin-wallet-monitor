FROM node:15.5.0-alpine

# create app directory
RUN mkdir -p /app
WORKDIR /app

# install dependencies
COPY package.json .
RUN npm install --quiet

# Bundle app source
COPY . /code

ENV THRESHOLD=100000

ENV ZMQNODE=192.168.68.122
ENV ZMQPORT=29000
# ENV APIHOST="api"

ENV RPCNODE=192.168.68.122
ENV RPCUSER=bitcoin
ENV RPCPASS=local127

CMD ["npm", "run", "start"]
