import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Upload, Keyboard, Loader2, CheckCircle2, AlertCircle, ScanLine, Building2, Clock, Search, X, Maximize2 } from "lucide-react";
import { useState, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";

export default function CheckIn() {
  const [activeTab, setActiveTab] = useState("egyptian");
  const [scanMode, setScanMode] = useState<"camera" | "upload" | "manual">("manual");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  // Egyptian form
  const [egName, setEgName] = useState("");
  const [egNationalId, setEgNationalId] = useState("");
  const [egPhone, setEgPhone] = useState("");
  const [egShift, setEgShift] = useState("");
  const [egUnitId, setEgUnitId] = useState<string>("");
  const [egCheckInDate, setEgCheckInDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  });

  // Russian form
  const [ruName, setRuName] = useState("");
  const [ruPassport, setRuPassport] = useState("");
  const [ruNationality, setRuNationality] = useState("Russian");
  const [ruGender, setRuGender] = useState<"male" | "female">("male");
  const [ruPhone, setRuPhone] = useState("");
  const [ruShift, setRuShift] = useState("");
  const [ruUnitId, setRuUnitId] = useState<string>("");
  const [ruCheckInDate, setRuCheckInDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });

  // Unit search
  const [unitSearch, setUnitSearch] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const unitType = useMemo(() => activeTab === "egyptian" ? "apartment" : "chalet", [activeTab]);
  const { data: units } = trpc.units.list.useQuery({ type: unitType, status: "all" });
  const availableUnits = useMemo(() => {
    const filtered = units?.filter(u => u.currentOccupants < u.beds) || [];
    if (!unitSearch.trim()) return filtered;
    const q = unitSearch.toLowerCase();
    return filtered.filter(u =>
      u.code.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.floor?.toLowerCase().includes(q)
    );
  }, [units, unitSearch]);

  const utils = trpc.useUtils();

  const scanEgyptian = trpc.ocr.scanEgyptianId.useMutation({
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        setEgName(result.name);
        setEgNationalId(result.nationalId);
        setConfidence(result.confidence);
        setScanResults(data.results);
        toast.success("تم استخراج البيانات بنجاح");
      }
      setIsScanning(false);
    },
    onError: (err) => {
      toast.error("فشل في استخراج البيانات: " + err.message);
      setIsScanning(false);
    },
  });

  const scanRussian = trpc.ocr.scanRussianPassport.useMutation({
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        setRuName(result.name);
        setRuPassport(result.passportNumber);
        setRuNationality(result.nationality);
        setRuGender(result.gender as "male" | "female");
        setConfidence(result.confidence);
        setScanResults(data.results);
        toast.success("تم استخراج البيانات بنجاح");
      }
      setIsScanning(false);
    },
    onError: (err) => {
      toast.error("فشل في استخراج البيانات: " + err.message);
      setIsScanning(false);
    },
  });

  const checkInEgyptian = trpc.egyptianResidents.checkIn.useMutation({
    onSuccess: () => {
      toast.success("تم التسكين بنجاح");
      resetForm();
      utils.units.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const checkInRussian = trpc.russianResidents.checkIn.useMutation({
    onSuccess: () => {
      toast.success("تم التسكين بنجاح");
      resetForm();
      utils.units.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setEgName(""); setEgNationalId(""); setEgPhone(""); setEgShift(""); setEgUnitId("");
    setRuName(""); setRuPassport(""); setRuNationality("Russian"); setRuGender("male"); setRuPhone(""); setRuShift(""); setRuUnitId("");
    setConfidence(null); setScanResults([]); setUnitSearch(""); setUploadedImage(null);
    const now = new Date().toISOString().slice(0, 16);
    setEgCheckInDate(now); setRuCheckInDate(now);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
      setIsScanning(true);
      if (activeTab === "egyptian") {
        scanEgyptian.mutate({ imageBase64: base64 });
      } else {
        scanRussian.mutate({ imageBase64: base64 });
      }
    };
    reader.readAsDataURL(file);
  }, [activeTab]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setScanMode("camera");
    } catch (err) {
      toast.error("لا يمكن الوصول للكاميرا");
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.9);
    setUploadedImage(base64);

    setIsScanning(true);
    if (activeTab === "egyptian") {
      scanEgyptian.mutate({ imageBase64: base64 });
    } else {
      scanRussian.mutate({ imageBase64: base64 });
    }

    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setScanMode("manual");
  }, [activeTab, cameraStream]);

  const handleEgyptianSubmit = () => {
    if (!egName || !egNationalId || !egUnitId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    checkInEgyptian.mutate({
      name: egName,
      nationalId: egNationalId,
      phone: egPhone || undefined,
      shift: egShift || undefined,
      unitId: parseInt(egUnitId),
      checkInDate: new Date(egCheckInDate).getTime(),
      ocrConfidence: confidence || undefined,
    });
  };

  const handleRussianSubmit = () => {
    if (!ruName || !ruPassport || !ruUnitId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    checkInRussian.mutate({
      name: ruName,
      passportNumber: ruPassport,
      nationality: ruNationality,
      gender: ruGender,
      phone: ruPhone || undefined,
      shift: ruShift || undefined,
      unitId: parseInt(ruUnitId),
      checkInDate: new Date(ruCheckInDate).getTime(),
      ocrConfidence: confidence || undefined,
    });
  };

  const shiftOptions = [
    { value: "morning", label: "صباحي (6ص - 2م)" },
    { value: "evening", label: "مسائي (2م - 10م)" },
    { value: "night", label: "ليلي (10م - 6ص)" },
    { value: "day_12h", label: "نهاري 12 ساعة (6ص - 6م)" },
    { value: "night_12h", label: "ليلي 12 ساعة (6م - 6ص)" },
  ];

  const UnitSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        الوحدة السكنية ({activeTab === "egyptian" ? "شقة" : "شاليه"}) *
      </Label>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <Input
          placeholder="ابحث بالكود أو الاسم..."
          value={unitSearch}
          onChange={(e) => setUnitSearch(e.target.value)}
          className="pr-9 mb-2"
        />
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="اختر الوحدة" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {availableUnits.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              لا توجد وحدات متاحة
            </div>
          ) : (
            availableUnits.map(u => (
              <SelectItem key={u.id} value={u.id.toString()}>
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs font-mono ${u.type === 'apartment' ? 'border-blue-300 text-blue-700' : 'border-red-300 text-red-700'}`}>
                    {u.code}
                  </Badge>
                  <span>{u.name}</span>
                  <span className="text-muted-foreground text-xs">({u.currentOccupants}/{u.beds})</span>
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {availableUnits.length > 0 && (
        <p className="text-xs text-muted-foreground">{availableUnits.length} وحدة متاحة</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تسكين فردي</h1>
        <p className="text-muted-foreground text-sm mt-1">تسكين ساكن جديد باستخدام المسح الضوئي أو الإدخال اليدوي</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetForm(); }}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="egyptian">مصري (شقة)</TabsTrigger>
          <TabsTrigger value="russian">روسي (شاليه)</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form and Scan Options */}
          <div className={`${uploadedImage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-primary" />
                  طريقة إدخال البيانات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    variant={scanMode === "camera" ? "default" : "outline"}
                    className="flex flex-col h-20 gap-2"
                    onClick={startCamera}
                  >
                    <Camera className="h-5 w-5" />
                    كاميرا
                  </Button>
                  <Button
                    variant={scanMode === "upload" ? "default" : "outline"}
                    className="flex flex-col h-20 gap-2"
                    onClick={() => {
                      setScanMode("upload");
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-5 w-5" />
                    رفع صورة
                  </Button>
                  <Button
                    variant={scanMode === "manual" ? "default" : "outline"}
                    className="flex flex-col h-20 gap-2"
                    onClick={() => {
                      setScanMode("manual");
                      cameraStream?.getTracks().forEach(t => t.stop());
                      setCameraStream(null);
                    }}
                  >
                    <Keyboard className="h-5 w-5" />
                    يدوي
                  </Button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />

                {scanMode === "camera" && cameraStream && (
                  <div className="mt-6 space-y-4">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black border-2 border-primary">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border-2 border-dashed border-white/50 m-8 rounded-lg pointer-events-none" />
                    </div>
                    <Button className="w-full" onClick={capturePhoto}>
                      التقاط صورة
                    </Button>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}

                {isScanning && (
                  <div className="mt-6 p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4 bg-muted/30">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="font-medium">جاري تحليل الصورة...</p>
                      <p className="text-xs text-muted-foreground mt-1">يتم استخراج البيانات باستخدام Tesseract OCR محلياً</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <TabsContent value="egyptian" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">بيانات الساكن المصري</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="eg-name">الاسم الكامل (ثلاثي أو رباعي) *</Label>
                      <Input
                        id="eg-name"
                        placeholder="الاسم الثلاثي أو الرباعي كاملاً"
                        value={egName}
                        onChange={(e) => setEgName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eg-id">الرقم القومي *</Label>
                      <Input
                        id="eg-id"
                        placeholder="14 رقم"
                        value={egNationalId}
                        onChange={(e) => setEgNationalId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eg-phone">رقم الهاتف</Label>
                      <Input
                        id="eg-phone"
                        placeholder="رقم الهاتف"
                        value={egPhone}
                        onChange={(e) => setEgPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الشيفت</Label>
                      <Select value={egShift} onValueChange={setEgShift}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الشيفت" />
                        </SelectTrigger>
                        <SelectContent>
                          {shiftOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        تاريخ ووقت التسكين *
                      </Label>
                      <Input
                        type="datetime-local"
                        value={egCheckInDate}
                        onChange={(e) => setEgCheckInDate(e.target.value)}
                      />
                    </div>
                    <UnitSelector value={egUnitId} onChange={setEgUnitId} />
                  </div>

                  <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleEgyptianSubmit}
                    disabled={checkInEgyptian.isLoading}
                  >
                    {checkInEgyptian.isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    تأكيد التسكين
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="russian" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">بيانات الساكن الروسي</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ru-name">الاسم الكامل *</Label>
                      <Input
                        id="ru-name"
                        placeholder="Full name"
                        value={ruName}
                        onChange={(e) => setRuName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ru-id">رقم الجواز *</Label>
                      <Input
                        id="ru-id"
                        placeholder="Passport number"
                        value={ruPassport}
                        onChange={(e) => setRuPassport(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الجنسية</Label>
                      <Input
                        value={ruNationality}
                        onChange={(e) => setRuNationality(e.target.value)}
                        placeholder="Russian"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>النوع *</Label>
                      <Select value={ruGender} onValueChange={(v: any) => setRuGender(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">ذكر</SelectItem>
                          <SelectItem value="female">أنثى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ru-phone">رقم الهاتف</Label>
                      <Input
                        id="ru-phone"
                        placeholder="Phone number"
                        value={ruPhone}
                        onChange={(e) => setRuPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الشيفت</Label>
                      <Select value={ruShift} onValueChange={setRuShift}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الشيفت" />
                        </SelectTrigger>
                        <SelectContent>
                          {shiftOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        تاريخ ووقت التسكين *
                      </Label>
                      <Input
                        type="datetime-local"
                        value={ruCheckInDate}
                        onChange={(e) => setRuCheckInDate(e.target.value)}
                      />
                    </div>
                    <UnitSelector value={ruUnitId} onChange={setRuUnitId} />
                  </div>

                  <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleRussianSubmit}
                    disabled={checkInRussian.isLoading}
                  >
                    {checkInRussian.isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    تأكيد التسكين
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </div>

          {/* Right Column: Uploaded Image Preview */}
          {uploadedImage && (
            <div className="lg:col-span-5 space-y-4">
              <Card className="sticky top-6">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    صورة المستند المرفوعة
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={() => setShowFullImage(true)}
                      title="تكبير الصورة"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive" 
                      onClick={() => setUploadedImage(null)}
                      title="إزالة الصورة"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative group cursor-zoom-in" onClick={() => setShowFullImage(true)}>
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded Document" 
                      className="w-full h-auto rounded-md border shadow-sm"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                    <p className="text-xs text-blue-700 leading-relaxed">
                      <strong>نصيحة للمراجعة:</strong> قارن الاسم والأرقام الموجودة في الصورة بالحقول المعبأة تلقائياً. يمكنك تعديل أي حقل يدوياً إذا وجدته غير دقيق.
                    </p>
                  </div>
                  {confidence !== null && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant={confidence > 80 ? "default" : "secondary"} className="text-[10px]">
                        دقة الـ OCR: {confidence}%
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </Tabs>

      {/* Full Screen Image Modal */}
      {showFullImage && uploadedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200"
          onClick={() => setShowFullImage(false)}
        >
          <Button 
            variant="outline" 
            size="icon" 
            className="absolute top-4 right-4 z-[101] rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setShowFullImage(false); }}
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={uploadedImage} 
              alt="Full Size Document" 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
