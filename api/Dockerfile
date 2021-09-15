FROM node:15.5.0-alpine as base

# create app directory
RUN mkdir -p /app
WORKDIR /app

# install dependencies
COPY package.json .

# FROM base as test
# RUN npm install
# COPY . ./code
# RUN npm run test

FROM base as prod
# Bundle app source
COPY . ./code
RUN npm install

# Exports
ENV PORT=5000
ENV HOST=0.0.0.0

EXPOSE 8080
CMD ["npm", "run", "start"]
