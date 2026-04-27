namespace Back.Application.Util
{
    public class TrackIdGenerator
    {
        static string _letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        static string _numbers = "0123456789";

        static Random _random = new Random();
        public static string GenerateTrackId()
        {
            return new string(Enumerable.Repeat(_letters, 2).Select(s => s[_random.Next(s.Length)]).ToArray()) + "-"+
                   new string(Enumerable.Repeat(_numbers, 4).Select(s => s[_random.Next(s.Length)]).ToArray()) + "-" +
                   new string(Enumerable.Repeat(_numbers, 4).Select(s => s[_random.Next(s.Length)]).ToArray());
        }
    }
}