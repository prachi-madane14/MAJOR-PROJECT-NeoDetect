import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UploadDemo = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      
      // Simulate metadata extraction
      setTimeout(() => {
        setMetadata({
          filename: file.name,
          size: `${(file.size / 1024).toFixed(2)} KB`,
          samplingRate: '500 Hz',
          channels: 4,
          duration: '300 seconds',
          format: 'EDF',
          electrodes: ['Fp1', 'Fp2', 'C3', 'C4']
        });
        
        toast({
          title: "File uploaded successfully!",
          description: "EEG metadata has been extracted and analyzed.",
        });
      }, 1500);
    }
  };

  return (
    <section id="upload-demo" className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            EEG Upload Demo
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload an EEG file to see how NeoDetect processes and analyzes 
            brain signal data for pain detection.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Upload Section */}
          <Card className="p-8 shadow-card">
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Upload EEG File</h3>
                <p className="text-muted-foreground text-sm">
                  Supported formats: EDF, BDF, GDF
                </p>
              </div>
              
              <div className="border-2 border-dashed border-border rounded-lg p-8 mb-6 hover:border-primary transition-colors">
                <input
                  type="file"
                  id="eeg-upload"
                  className="hidden"
                  accept=".edf,.bdf,.gdf"
                  onChange={handleFileUpload}
                />
                <label htmlFor="eeg-upload" className="cursor-pointer">
                  <FileText size={48} className="text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">
                    Drag and drop your EEG file here, or click to browse
                  </p>
                  <Button variant="outline" className="mt-2">
                    Choose File
                  </Button>
                </label>
              </div>
              
              {uploadedFile && (
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                  <CheckCircle size={20} />
                  <span className="text-sm font-medium">
                    {uploadedFile.name} uploaded successfully
                  </span>
                </div>
              )}
            </div>
          </Card>
          
          {/* Metadata Section */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <Info className="text-primary" size={24} />
              <h3 className="text-xl font-semibold text-foreground">File Metadata</h3>
            </div>
            
            {metadata ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Filename</div>
                    <div className="font-medium">{metadata.filename}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Size</div>
                    <div className="font-medium">{metadata.size}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Sampling Rate</div>
                    <div className="font-medium">{metadata.samplingRate}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Channels</div>
                    <div className="font-medium">{metadata.channels}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Duration</div>
                    <div className="font-medium">{metadata.duration}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Format</div>
                    <div className="font-medium">{metadata.format}</div>
                  </div>
                </div>
                
                <div className="bg-muted p-3 rounded">
                  <div className="text-sm text-muted-foreground mb-2">Electrode Placement</div>
                  <div className="flex flex-wrap gap-2">
                    {metadata.electrodes.map((electrode: string) => (
                      <span
                        key={electrode}
                        className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full"
                      >
                        {electrode}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="text-muted-foreground" size={24} />
                </div>
                <p className="text-muted-foreground">
                  Upload an EEG file to view metadata and processing information
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};

export default UploadDemo;