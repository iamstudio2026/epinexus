# Despliegue en VPS de Hostinger (Ubuntu/Debian) — EPINEXUS

Front estático (Vite build → Nginx) + HTTPS Let's Encrypt + CI desde GitHub
Actions. El RAG sigue contra tu n8n existente (no se instala Node en el VPS).

Sustituye las variables marcadas en MAYÚSCULAS antes de pegar.

```
DOMAIN       = epinexus.iamstudio.cloud         (o el que elijas)
VPS_USER     = deploy                            (usuario sin sudo NOPASSWD ideal)
VPS_PATH     = /var/www/epinexus
RAG_ENDPOINT = https://n8n.iamstudio.cloud/webhook/epinexus-rag
```

## 1. DNS (panel de Hostinger)

Crea un registro **A** apuntando a la IP pública del VPS:

```
Tipo: A    Nombre: epinexus    Valor: <IP_VPS>    TTL: 3600
```

Verifica desde tu máquina:

```bash
dig +short epinexus.iamstudio.cloud
```

## 2. Preparar el VPS (una sola vez, como root o sudo)

```bash
apt update && apt upgrade -y
apt install -y nginx rsync certbot python3-certbot-nginx ufw

# Usuario de deploy sin privilegios shell raros
adduser --disabled-password --gecos "" deploy
usermod -aG www-data deploy

# Carpeta destino
mkdir -p /var/www/epinexus
chown -R deploy:www-data /var/www/epinexus
chmod 755 /var/www/epinexus

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Permitir al usuario deploy recargar nginx (sudoers minimal)
echo 'deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx' \
  > /etc/sudoers.d/deploy-nginx
chmod 440 /etc/sudoers.d/deploy-nginx
```

## 3. Clave SSH para GitHub Actions

En tu máquina local:

```bash
ssh-keygen -t ed25519 -f ./epinexus_deploy -C "github-actions@epinexus" -N ""
```

En el VPS:

```bash
mkdir -p /home/deploy/.ssh
cat epinexus_deploy.pub >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Guarda los secretos en GitHub (`Settings → Secrets and variables → Actions`):

| Secret                  | Valor                                                |
|-------------------------|------------------------------------------------------|
| `VPS_HOST`              | IP o subdominio del VPS                              |
| `VPS_USER`              | `deploy`                                             |
| `VPS_PORT`              | `22` (o el que uses)                                 |
| `VPS_PATH`              | `/var/www/epinexus`                                  |
| `VPS_SSH_KEY`           | Contenido de `epinexus_deploy` (clave **privada**)   |
| `VITE_RAG_ENDPOINT`     | `https://n8n.iamstudio.cloud/webhook/epinexus-rag`   |
| `VITE_SUPABASE_URL`     | (opcional) URL del proyecto Supabase                 |
| `VITE_SUPABASE_ANON_KEY`| (opcional) anon key                                  |

## 4. Nginx + HTTPS

```bash
# Copia el vhost editado (reemplaza __DOMAIN__ y __ROOT__)
sed -e 's|__DOMAIN__|epinexus.iamstudio.cloud|g' \
    -e 's|__ROOT__|/var/www/epinexus|g' \
    deploy/nginx-epinexus.conf > /etc/nginx/sites-available/epinexus.conf

ln -s /etc/nginx/sites-available/epinexus.conf /etc/nginx/sites-enabled/epinexus.conf
nginx -t && systemctl reload nginx

# Cert (responde a las preguntas; --redirect ya queda implícito)
certbot --nginx -d epinexus.iamstudio.cloud
```

Certbot programa renovación automática (`systemctl list-timers | grep certbot`).

## 5. Primer despliegue

Haz `git push origin main` desde local. El workflow de
`.github/workflows/deploy.yml` corre `npm ci`, `npm test`, `npm run build`,
rsync de `dist/` a `/var/www/epinexus/` y `systemctl reload nginx`.

Sigue el log en `Actions` del repo. Cuando termine, abre
`https://epinexus.iamstudio.cloud`.

## 6. Despliegue manual (si necesitas debugear)

Desde local:

```bash
npm run build
rsync -avz --delete -e "ssh -p 22" dist/ deploy@IP_VPS:/var/www/epinexus/
ssh deploy@IP_VPS "sudo nginx -t && sudo systemctl reload nginx"
```

## 7. Comprobaciones rápidas

```bash
curl -I https://epinexus.iamstudio.cloud      # 200 OK
curl -I https://epinexus.iamstudio.cloud/x    # 200 (SPA fallback a index.html)
tail -f /var/log/nginx/epinexus.access.log
```

## 8. Si más adelante quieres correr `server/rag.js` en el VPS

```bash
apt install -y nodejs npm
npm i -g pm2
pm2 start server/rag.js --name epinexus-rag
pm2 save && pm2 startup
```

Y añades un `location /rag { proxy_pass http://127.0.0.1:8787; }` al vhost.
