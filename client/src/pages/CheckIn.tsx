import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Upload, Keyboard, Loader2, CheckCircle2, AlertCircle, ScanLine, Building2, Clock, Search } from "lucide-react";
import { useState, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";

export default function CheckIn() {
  const [activeTab, setActiveTab] = useState("egyptian");
  const [scanMode, setScanMode] = useState<"camera" | "upload" | "manual">("manual");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);

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
    setConfidence(null); setScanResults([]); setUnitSearch("");
    const now = new Date().toISOString().slice(0, 16);
    setEgCheckInDate(now); setRuCheckInDate(now);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تسكين فردي</h1>
        <p className="text-muted-foreground text-sm mt-1">تسكين ساكن جديد باستخدام المسح الضوئي أو الإدخال اليدوي</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetForm(); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="egyptian" className="gap-2">
            مصري (شقة)
          </TabsTrigger>
          <TabsTrigger value="russian" className="gap-2">
            روسي (شاليه)
          </TabsTrigger>
        </TabsList>

        {/* Scan Options */}
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              طريقة إدخال البيانات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={scanMode === "camera" ? "default" : "outline"}
                className="h-auto py-3 flex flex-col gap-1"
                onClick={startCamera}
              >
                <Camera className="h-5 w-5" />
                <span className="text-xs">كاميرا</span>
              </Button>
              <Button
                variant={scanMode === "upload" ? "default" : "outline"}
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => { setScanMode("upload"); fileInputRef.current?.click(); }}
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs">رفع صورة</span>
              </Button>
              <Button
                variant={scanMode === "manual" ? "default" : "outline"}
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => setScanMode("manual")}
              >
                <Keyboard className="h-5 w-5" />
                <span className="text-xs">يدوي</span>
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Camera View */}
            {scanMode === "camera" && cameraStream && (
              <div className="mt-4 relative">
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
                <canvas ref={canvasRef} className="hidden" />
                <Button
                  className="absolute bottom-4 left-1/2 -translate-x-1/2"
                  onClick={capturePhoto}
                >
                  <Camera className="h-4 w-4 ml-2" />
                  التقاط
                </Button>
              </div>
            )}

            {/* Scanning indicator */}
            {isScanning && (
              <div className="mt-4 flex items-center justify-center gap-2 p-4 bg-primary/5 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-primary">جاري تحليل الصورة واستخراج البيانات...</span>
              </div>
            )}

            {/* Confidence indicator */}
            {confidence !== null && (
              <div className="mt-3 flex items-center gap-2">
                {confidence >= 80 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
                <span className="text-sm">
                  درجة الثقة: <strong className={confidence >= 80 ? "text-green-600" : "text-orange-600"}>{confidence}%</strong>
                </span>
                {confidence < 80 && (
                  <span className="text-xs text-orange-600">يرجى التحقق من البيانات</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Egyptian Form */}
        <TabsContent value="egyptian">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">بيانات الساكن المصري</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>الاسم الكامل (ثلاثي/رباعي) *</Label>
                  <Input value={egName} onChange={e => setEgName(e.target.value)} placeholder="الاسم الثلاثي أو الرباعي كاملاً" />
                </div>
                <div>
                  <Label>الرقم القومي *</Label>
                  <Input value={egNationalId} onChange={e => setEgNationalId(e.target.value)} placeholder="14 رقم" maxLength={14} className="font-mono tracking-wider" dir="ltr" />
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input value={egPhone} onChange={e => setEgPhone(e.target.value)} placeholder="رقم الهاتف" dir="ltr" />
                </div>
                <div>
                  <Label>الشيفت</Label>
                  <Select value={egShift} onValueChange={setEgShift}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الشيفت" />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    تاريخ ووقت التسكين
                  </Label>
                  <Input
                    type="datetime-local"
                    value={egCheckInDate}
                    onChange={e => setEgCheckInDate(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <UnitSelector value={egUnitId} onChange={setEgUnitId} />

              <Button
                className="w-full"
                onClick={handleEgyptianSubmit}
                disabled={checkInEgyptian.isPending}
              >
                {checkInEgyptian.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                )}
                تأكيد التسكين
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Russian Form */}
        <TabsContent value="russian">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">بيانات الساكن الروسي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>الاسم الكامل *</Label>
                  <Input value={ruName} onChange={e => setRuName(e.target.value)} placeholder="Full name" dir="ltr" />
                </div>
                <div>
                  <Label>رقم الجواز *</Label>
                  <Input value={ruPassport} onChange={e => setRuPassport(e.target.value)} placeholder="Passport number" className="font-mono tracking-wider" dir="ltr" />
                </div>
                <div>
                  <Label>الجنسية</Label>
                  <Input value={ruNationality} onChange={e => setRuNationality(e.target.value)} placeholder="Nationality" dir="ltr" />
                </div>
                <div>
                  <Label>النوع *</Label>
                  <Select value={ruGender} onValueChange={(v) => setRuGender(v as "male" | "female")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">ذكر</SelectItem>
                      <SelectItem value="female">أنثى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input value={ruPhone} onChange={e => setRuPhone(e.target.value)} placeholder="Phone number" dir="ltr" />
                </div>
                <div>
                  <Label>الشيفت</Label>
                  <Select value={ruShift} onValueChange={setRuShift}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الشيفت" />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    تاريخ ووقت التسكين
                  </Label>
                  <Input
                    type="datetime-local"
                    value={ruCheckInDate}
                    onChange={e => setRuCheckInDate(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <UnitSelector value={ruUnitId} onChange={setRuUnitId} />

              <Button
                className="w-full"
                onClick={handleRussianSubmit}
                disabled={checkInRussian.isPending}
              >
                {checkInRussian.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                )}
                تأكيد التسكين
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
