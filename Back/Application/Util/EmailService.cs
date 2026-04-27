namespace Back.Application.Util {
    public class EmailService
    {
     public   static bool IsEmailValid (string email) => email.Contains("@") && email.Contains(".");
    }
}