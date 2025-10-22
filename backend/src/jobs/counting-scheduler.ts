import countingSchedulerService from '../services/counting-scheduler.service';

async function main() {
  console.log('⏰ Iniciando processamento de planos cíclicos...');
  await countingSchedulerService.processScheduledPlans();
  console.log('✅ Processamento concluído!');
}

main()
  .catch(e => {
    console.error('❌ Erro no scheduler:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
