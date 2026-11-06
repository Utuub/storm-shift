# Storm Shift game server (serves the game + runs online Crew Shift mode)
FROM node:20-alpine

WORKDIR /app

# install dependencies first so Docker can cache this layer
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# game files
COPY index.html style.css ./
COPY src ./src
COPY assets ./assets
COPY server ./server

ENV PORT=3000
ENV IN_DOCKER=1
EXPOSE 3000

CMD ["node", "server/server.js"]
