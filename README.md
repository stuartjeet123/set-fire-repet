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
