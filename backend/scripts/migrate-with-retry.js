// `prisma migrate deploy` contra um MySQL recem-subido no CI falha
// esporadicamente com "P1017: Server has closed the connection", mesmo depois
// do healthcheck do docker-compose (`mysqladmin ping`) reportar healthy — o
// entrypoint do mysql:8.0 sobe um processo temporario para bootstrap, sujeito
// a responder ping, e so depois reinicia como o servidor definitivo; ha uma
// janela curta em que o ping mais recente ainda pode ter acertado o processo
// temporario sendo derrubado. Isso vem derrubando o CI (job "Backend") em
// commits sem nenhuma relacao com o schema ha varios dias.
//
// Retry com backoff resolve na pratica: a segunda tentativa, poucos segundos
// depois, sempre encontra o servidor definitivo de pe.
const { execSync } = require('child_process');

const MAX_ATTEMPTS = 5;
const DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`\nprisma migrate deploy falhou apos ${MAX_ATTEMPTS} tentativas.`);
        process.exit(1);
      }
      console.warn(
        `\n[migrate-with-retry] Tentativa ${attempt}/${MAX_ATTEMPTS} falhou ` +
          `(provavel corrida de inicializacao do MySQL — ver comentario no topo ` +
          `deste arquivo). Tentando novamente em ${DELAY_MS}ms...\n`
      );
      await sleep(DELAY_MS);
    }
  }
}

main();
