# Pitchlight

## Run with Docker

Install Docker Desktop, then from this folder run:

```sh
docker compose up --build -d
```

Open [http://localhost:8080](http://localhost:8080) and allow microphone access
in the browser. The app uses the browser microphone; Docker does not need direct
access to the microphone.

Stop the app with:

```sh
docker compose down
```

If port 8080 is already in use, set `PORT` before starting. For example, in
PowerShell:

```powershell
$env:PORT = "8081"
docker compose up --build -d
```

Then open [http://localhost:8081](http://localhost:8081).

## Deploy from Portainer

Push the application and Docker files to the Git repository you want Portainer
to deploy. Create a stack using the **Git repository** build method and set:

- **Repository reference:** the branch to deploy, for example `refs/heads/main`
- **Compose path:** `compose.yaml`
- **Environment variable `PORT`:** optional; defaults to `8080`

Deploy the stack, then open the Docker host's address on the selected port.
Browsers only allow microphone access from secure contexts: use `localhost` for
local access, or HTTPS when accessing the stack from another machine.

### Nginx Proxy Manager

The app's default published port is `8080` (or the value of `PORT`). In Nginx
Proxy Manager, add a Proxy Host with:

- **Domain name:** a hostname whose DNS points to the Docker host
- **Scheme:** `http`
- **Forward hostname/IP:** the Docker host's reachable IP address
- **Forward port:** `8080` (or the value of `PORT`)

Do not use `localhost` as the forward hostname when Nginx Proxy Manager runs in
its own container; that would point back to Nginx Proxy Manager itself. On the
Proxy Host's **SSL** tab, request or select a certificate and enable **Force
SSL**. Make sure DNS and the firewall route ports 80 and 443 to Nginx Proxy
Manager, then open the app using `https://your-domain`.
