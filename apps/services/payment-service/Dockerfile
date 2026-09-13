FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --ignore-scripts

COPY . .

RUN npx prisma generate

RUN npm run build

RUN npm prune --omit=dev

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
