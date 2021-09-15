FROM node:15.5.0-alpine

# create app directory
RUN mkdir -p /app
WORKDIR /app

# install dependencies
COPY package.json .
RUN npm install --quiet

# Bundle app source
COPY . /code

ENV ZMQNODE=192.168.68.122
ENV ZMQPORT=29000
# ENV APIHOST="api"
ENV THRESHOLD=100

CMD ["npm", "run", "start"]
