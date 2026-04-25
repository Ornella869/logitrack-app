namespace Back.Background
{

    public class UptimerService : BackgroundService
    {
        private readonly HttpClient _httpClient;
        private readonly string _url = "https://tu-app.onrender.com/api/health"; // <--- Tu URL real de Render

        public UptimerService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Esperamos un minuto antes del primer ping para asegurar que la app subió bien
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var response = await _httpClient.GetAsync(_url, stoppingToken);
                    // Esto aparecerá en los logs de Render cada 14 min
                    Console.WriteLine($"[Keep-Alive] Ping enviado a las {DateTime.Now}. Estado: {response.StatusCode}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Keep-Alive] Error al enviar ping: {ex.Message}");
                }
                await Task.Delay(TimeSpan.FromMinutes(14), stoppingToken);
            }
        }
    }
}