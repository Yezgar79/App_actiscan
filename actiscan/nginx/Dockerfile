FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

# Generate self-signed SSL certificate
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/actiscan.key \
      -out  /etc/nginx/ssl/actiscan.crt \
      -subj "/C=MX/ST=Jalisco/L=Guadalajara/O=ActiScan/OU=TI/CN=actiscan.mx"

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
