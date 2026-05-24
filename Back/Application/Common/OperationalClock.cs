namespace Back.Application.Common
{
    public static class OperationalClock
    {
        private static readonly TimeZoneInfo ArgentinaTimeZone = ResolveArgentinaTimeZone();

        public static DateTime TodayUtcDate =>
            DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ArgentinaTimeZone).Date, DateTimeKind.Utc);

        public static DateTime Now =>
            TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ArgentinaTimeZone);

        public static DateTime TodayStartUtc => StartUtcForOperationalDate(TodayUtcDate);

        public static DateTime TomorrowStartUtc => StartUtcForOperationalDate(TodayUtcDate.AddDays(1));

        public static DateTime StartUtcForOperationalDate(DateTime date)
        {
            var localDate = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
            return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(localDate, ArgentinaTimeZone), DateTimeKind.Utc);
        }

        private static TimeZoneInfo ResolveArgentinaTimeZone()
        {
            foreach (var id in new[] { "Argentina Standard Time", "America/Argentina/Buenos_Aires" })
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }

            return TimeZoneInfo.Utc;
        }
    }
}
