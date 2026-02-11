FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/data/pdf-store
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "src/index.js"]
