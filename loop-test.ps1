for ($i=1; $i -le 110; $i++) {
    curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000/api/v1/listings
}