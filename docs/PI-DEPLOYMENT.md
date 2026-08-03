# Raspberry-Pi-Deployment

Dieses Runbook beschreibt den reproduzierbaren Release auf
`pi-ianclaw.local`. Befehle ohne `ssh` laufen im lokalen Repository. Die
repository-lokalen Verzeichnisse `workspace/`, `.local/`, `node_modules/` und
`dist/` werden nie auf den Pi übertragen.

## 1. Lokalen Release prüfen

```zsh
./scripts/qa all
./scripts/qa release
git status --short
git rev-parse HEAD
```

Der Arbeitsbaum muss leer sein. Deployt wird ausschließlich ein bereits zu
`origin` gepushter Commit.

## 2. Claude-Anmeldung prüfen

```zsh
ssh ian_claw@pi-ianclaw.local \
  'sudo -u claims-ai env HOME=/var/lib/claims-ai CLAUDE_CONFIG_DIR=/var/lib/claims-ai/.claude PATH=/var/lib/claims-ai/.bun/bin:/usr/local/bin:/usr/bin:/bin /var/lib/claims-ai/.bun/bin/claude auth status'
```

Erwartet werden `"loggedIn": true`, `"authMethod": "claude.ai"` und
`"subscriptionType": "pro"`. Ein ausgeschöpftes Nutzungsfenster wird erst bei
einer echten Claude-Aktion sichtbar; dafür wird kein separater Testaufruf
verbraucht.

Falls eine erneute Anmeldung erforderlich ist:

```zsh
ssh -t ian_claw@pi-ianclaw.local \
  'sudo -u claims-ai env HOME=/var/lib/claims-ai CLAUDE_CONFIG_DIR=/var/lib/claims-ai/.claude PATH=/var/lib/claims-ai/.bun/bin:/usr/local/bin:/usr/bin:/bin /var/lib/claims-ai/.bun/bin/claude auth login'
```

## 3. Bestehenden Workspace vor dem Release erfassen

```zsh
ssh ian_claw@pi-ianclaw.local \
  "sudo -u claims-ai zsh -c 'cd / && find /var/lib/claims-ai/workspace -type f ! -name .instance.lock -print0 | sort -z | xargs -0 -r sha256sum'" \
  > /tmp/claims-ai-workspace-before.sha256
```

## 4. Gepushten Stand bereitstellen

```zsh
release_dir=/tmp/claims-ai-portfolio-release
ssh ian_claw@pi-ianclaw.local "rm -rf '${release_dir}' && mkdir -p '${release_dir}'"
rsync -az --delete \
  --exclude .git \
  --exclude .local \
  --exclude workspace \
  --exclude node_modules \
  --exclude dist \
  ./ "ian_claw@pi-ianclaw.local:${release_dir}/"
ssh -t ian_claw@pi-ianclaw.local \
  "cd '${release_dir}' && sudo ./deploy/pi/install.zsh && sudo systemctl restart claims-ai-portfolio"
```

Das Installationsskript kopiert den Release nach
`/opt/claims-ai-portfolio/current`, installiert die festgelegten Abhängigkeiten
und baut Anwendung sowie ARM64-Release. Der persistente Workspace unter
`/var/lib/claims-ai/workspace` bleibt unangetastet.

## 4a. Öffentliche Betreiberangaben vor dem ersten Release hinterlegen

Die Datei mit Impressums- und Datenschutzangaben liegt bewusst außerhalb des
Repositorys. Sie wird nicht per `rsync` übertragen. Vor dem ersten Release
wird die lokal geprüfte Datei mit restriktiven Rechten auf den Pi kopiert:

```zsh
scp .local/public-site-information.json \
  ian_claw@pi-ianclaw.local:/tmp/public-site-information.json
ssh ian_claw@pi-ianclaw.local \
  'sudo install -o claims-ai -g claims-ai -m 0600 /tmp/public-site-information.json /var/lib/claims-ai/public-site-information.json && rm /tmp/public-site-information.json'
```

Danach öffnen Sie ohne Anmeldung `https://claims-ai.ian-buck.dev/impressum`,
`/datenschutz` und `/nutzungshinweise` und lassen die Texte vor einer
allgemeinen Veröffentlichung rechtlich prüfen. Das Installationsskript legt
bei fehlender Datei nur eine nicht veröffentlichungsreife Vorlage an.

## 5. Release und Workspace prüfen

```zsh
ssh ian_claw@pi-ianclaw.local \
  'systemctl is-active claims-ai-portfolio && curl --fail --silent --show-error http://127.0.0.1:3210/api/health'
ssh ian_claw@pi-ianclaw.local \
  "sudo -u claims-ai zsh -c 'cd / && find /var/lib/claims-ai/workspace -type f ! -name .instance.lock -print0 | sort -z | xargs -0 -r sha256sum'" \
  > /tmp/claims-ai-workspace-after.sha256
diff -u /tmp/claims-ai-workspace-before.sha256 /tmp/claims-ai-workspace-after.sha256
```

Der `diff` muss vor neuen Live-Tests leer sein. Die bewusst ausgeschlossene
Datei `.instance.lock` enthält die Kennung der laufenden Serverinstanz und wird
bei jedem Neustart ersetzt. Danach werden Anmeldung, beide Erfassungsarten und
die Potenzialanalyse über `https://claims-ai.ian-buck.dev` geprüft.

Für den Chat-Smoke wird ein neuer Prozess mit dem Standardmodus `Chat` angelegt,
eine anonymisierte Unterlage ausgewertet, mindestens eine Korrektur über eine
Schritt- oder Übergangsreferenz gesendet und das Prozessbild bestätigt. Danach
muss ohne manuellen Start eine Potenzialanalyse unter
`/processes/<ID>/opportunities` erscheinen. Browserkonsole und fehlgeschlagene
Netzwerkanfragen müssen leer bleiben.

Vor dem Löschen eines Chat-Prozesses werden dessen aktive, ersetzte und noch
nicht übernommene Claude-Sitzungen entfernt. Ein Fehler außer einer bereits
fehlenden Sitzung bricht das Löschen ab und lässt den Prozess für einen Retry
intakt. Nach einem Lösch-Smoke dürfen weder das Prozessverzeichnis noch eine der
in `chat/session.json` zuvor protokollierten Sitzungen verbleiben.

## 6. Fehlerdiagnose und gezielter Retry

```zsh
ssh ian_claw@pi-ianclaw.local \
  'sudo journalctl -u claims-ai-portfolio --since "15 minutes ago" --no-pager'
```

Nach einem Fehler wird zuerst dessen technische Ursache bestimmt. Ein Fix wird
lokal fokussiert getestet, vollständig validiert, committed, gepusht und erneut
deployt. Anschließend wird im bestehenden Prozess nur die fehlgeschlagene Phase
wiederholt. Ein Prozess wird nicht gelöscht und neu begonnen, wenn sein
kanonischer Zustand einen sicheren Retry erlaubt. Bereits gespeicherte
Hypothesen bleiben bei einem Fehler der Szenarienphase erhalten.
