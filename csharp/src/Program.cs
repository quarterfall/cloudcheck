using System;
using System.Collections.Generic;
using Newtonsoft.Json;

public class Program
{
    public class Employee
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsManager { get; set; }
        public DateTime JoinedDate { get; set; }
        public IList<string> Titles { get; set; }
    }

    public static void Main()
    {
        string json = @"{
                          'FirstName': 'Shiva',
                          'LastName': 'Kumar',
                          'IsManager': true,
                          'JoinedDate': '2014-02-10T00:00:00Z',
                          'Titles': [
                            'Sr. Software Engineer',
                            'Applications Architect'
                          ]
                        }";

        Employee employee = JsonConvert.DeserializeObject<Employee>(json);

        Console.WriteLine(employee.FirstName);
        Console.WriteLine(employee.LastName);
        Console.WriteLine(employee.JoinedDate);
        foreach (string title in employee.Titles)
        {
            Console.WriteLine("  {0}", title);
        }
    }
}