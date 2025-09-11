import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, BookOpen, ExternalLink } from "lucide-react";

const AboutSection = () => {
  const teamMembers = [
    { name: "Chaitra Nair", role: "Team Lead & ML Engineer" },
    { name: "Prachi Madane", role: "Data Scientist" },
    { name: "Shruti Pachpor", role: "EEG Signal Processing" },
    { name: "Tanmay Narayankar", role: "Software Developer" },
  ];

  const references = [
    {
      title: "EEG-based pain detection in newborns using machine learning",
      source: "PMC11891568",
      type: "Research Paper",
      url: "#",
    },
    {
      title: "Neonatal EEG Dataset for Pain Analysis",
      source: "Zenodo Dataset",
      type: "Dataset",
      url: "#",
    },
    {
      title: "Signal Processing Techniques for EEG Analysis",
      source: "IEEE Transactions",
      type: "Reference",
      url: "#",
    },
  ];

  const technologies = [
    "Python", "TensorFlow", "Scikit-learn", "MNE-Python", 
    "NumPy", "Pandas", "Matplotlib", "Streamlit"
  ];

  return (
    <section id="about" className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            About NeoDetect
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A final year project dedicated to improving neonatal care through 
            advanced AI-powered pain detection using EEG technology.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
          {/* Team Section */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <Users className="text-primary" size={24} />
              <h3 className="text-2xl font-semibold text-foreground">Our Team</h3>
            </div>
            
            <div className="space-y-4 mb-6">
              {teamMembers.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <h4 className="font-semibold text-foreground">{member.name}</h4>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t border-border pt-6">
              <div className="flex items-center space-x-3 mb-3">
                <GraduationCap className="text-primary" size={20} />
                <h4 className="font-semibold text-foreground">Project Guide</h4>
              </div>
              <div className="p-4 bg-primary/5 rounded-lg">
                <h4 className="font-semibold text-foreground">Dr. Megha Trivedi</h4>
                <p className="text-sm text-muted-foreground">Faculty Advisor & Research Supervisor</p>
              </div>
            </div>
          </Card>
          
          {/* Project Details */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <BookOpen className="text-primary" size={24} />
              <h3 className="text-2xl font-semibold text-foreground">Project Overview</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-foreground mb-3">Objective</h4>
                <p className="text-muted-foreground text-sm">
                  Develop an AI-powered system for detecting pain in neonates using 
                  EEG signals, providing healthcare professionals with a non-invasive, 
                  objective tool for pain assessment in NICU environments.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-3">Methodology</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• EEG data preprocessing and artifact removal</li>
                  <li>• Feature extraction from frequency domain analysis</li>
                  <li>• Machine learning classification for pain detection</li>
                  <li>• Model validation and performance evaluation</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-3">Technologies Used</h4>
                <div className="flex flex-wrap gap-2">
                  {technologies.map((tech) => (
                    <Badge key={tech} variant="secondary" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* References Section */}
        <Card className="p-8 shadow-card max-w-4xl mx-auto">
          <h3 className="text-2xl font-semibold text-foreground mb-6 text-center">
            References & Resources
          </h3>
          
          <div className="space-y-4">
            {references.map((ref, index) => (
              <div key={index} className="flex items-start justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <div className="flex-1">
                  <h4 className="font-medium text-foreground mb-1">{ref.title}</h4>
                  <p className="text-sm text-muted-foreground">{ref.source}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {ref.type}
                  </Badge>
                  <ExternalLink size={16} className="text-muted-foreground hover:text-primary cursor-pointer" />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 p-6 bg-gradient-accent rounded-lg text-center">
            <h4 className="text-lg font-semibold text-accent-foreground mb-2">
              Final Year Project 2024
            </h4>
            <p className="text-accent-foreground/80 text-sm">
              Department of Computer Engineering<br />
              Submitted in partial fulfillment of the requirements for the degree of Bachelor of Engineering
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default AboutSection;