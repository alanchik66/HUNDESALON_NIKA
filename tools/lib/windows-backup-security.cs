using System;
using System.IO;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;

internal static class WindowsBackupSecurity
{
    private static readonly Encoding Utf8 = new UTF8Encoding(false, true);

    private static int Main(string[] args)
    {
        if (args.Length != 1)
            return 1;

        try
        {
            Console.InputEncoding = Utf8;
            Console.OutputEncoding = Utf8;
            string input = Console.In.ReadToEnd();
            switch (args[0])
            {
                case "acl-file":
                    SetFileAccess(input, false);
                    return 0;
                case "acl-directory":
                    SetFileAccess(input, true);
                    return 0;
                case "protect":
                case "unprotect":
                    TransformKey(input, args[0] == "protect");
                    return 0;
                default:
                    return 1;
            }
        }
        catch
        {
            // Do not disclose key material, a local path, or a provider error.
            return 1;
        }
    }

    private static void SetFileAccess(string target, bool directory)
    {
        FileSystemSecurity acl = directory ? (FileSystemSecurity)new DirectorySecurity() : new FileSecurity();
        InheritanceFlags inheritance = directory
            ? InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit
            : InheritanceFlags.None;
        acl.SetAccessRuleProtection(true, false);

        using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
        {
            SecurityIdentifier system = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            foreach (SecurityIdentifier principal in new[] { identity.User, system })
                acl.AddAccessRule(new FileSystemAccessRule(
                    principal, FileSystemRights.FullControl, inheritance,
                    PropagationFlags.None, AccessControlType.Allow));
        }

        if (directory)
            Directory.SetAccessControl(target, (DirectorySecurity)acl);
        else
            File.SetAccessControl(target, (FileSecurity)acl);
    }

    private static void TransformKey(string encoded, bool protect)
    {
        byte[] bytes = Convert.FromBase64String(encoded);
        byte[] entropy = Utf8.GetBytes("HUNDESALON_NIKA backup key v1");
        byte[] result = null;
        try
        {
            result = protect
                ? ProtectedData.Protect(bytes, entropy, DataProtectionScope.CurrentUser)
                : ProtectedData.Unprotect(bytes, entropy, DataProtectionScope.CurrentUser);
            Console.Out.Write(Convert.ToBase64String(result));
        }
        finally
        {
            Array.Clear(bytes, 0, bytes.Length);
            if (result != null)
                Array.Clear(result, 0, result.Length);
        }
    }
}
