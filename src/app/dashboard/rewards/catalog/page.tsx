"use client";

import { useState } from "react";
import { useCatalog, useRedemptions, useRewardsBalance } from "@/hooks/use-rewards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Gift,
  Star,
  Search,
  ShoppingCart,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CatalogItem, Redemption } from "@/types/rewards";

const categoryConfig = {
  digital: { label: "Digital", icon: Sparkles, color: "text-purple-500" },
  physical: { label: "Físico", icon: Package, color: "text-blue-500" },
  experience: { label: "Experiencia", icon: Star, color: "text-amber-500" },
  discount: { label: "Descuento", icon: Tag, color: "text-green-500" },
  general: { label: "General", icon: Gift, color: "text-gray-500" },
};

const statusConfig = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  approved: { label: "Aprobado", color: "bg-blue-500", icon: CheckCircle2 },
  rejected: { label: "Rechazado", color: "bg-red-500", icon: XCircle },
  fulfilled: { label: "Completado", color: "bg-green-500", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-gray-500", icon: XCircle },
};

function CatalogItemCard({ 
  item, 
  userPoints,
  onRedeem,
}: { 
  item: CatalogItem;
  userPoints: number;
  onRedeem: () => void;
}) {
  const category = categoryConfig[item.category as keyof typeof categoryConfig] || categoryConfig.general;
  const CategoryIcon = category.icon;
  const itemCost = item.pointsCost ?? item.cost;
  const canAfford = userPoints >= itemCost;
  const isAvailable = (item.isAvailable ?? item.isActive) && (item.stock === null || item.stock > 0);

  return (
    <Card className={cn(
      "transition-all hover:shadow-lg",
      !isAvailable && "opacity-60"
    )}>
      {/* Image */}
      <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
        {item.imageUrl ? (
          <img 
            src={item.imageUrl} 
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gift className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Category Badge */}
        <Badge 
          variant="secondary" 
          className="absolute top-2 left-2"
        >
          <CategoryIcon className={cn("h-3 w-3 mr-1", category.color)} />
          {category.label}
        </Badge>

        {/* Featured Badge */}
        {item.isFeatured && (
          <Badge className="absolute top-2 right-2 bg-amber-500">
            <Star className="h-3 w-3 mr-1" />
            Destacado
          </Badge>
        )}

        {/* Out of Stock */}
        {item.stock !== null && item.stock <= 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="destructive" className="text-sm">
              Agotado
            </Badge>
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-base line-clamp-1">{item.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {item.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-2">
        {/* Stock info */}
        {item.stock !== null && item.stock > 0 && (
          <div className="text-sm text-muted-foreground mb-2">
            <Package className="h-4 w-4 inline mr-1" />
            {item.stock} disponibles
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          <span className={cn(
            "text-2xl font-bold",
            !canAfford && "text-muted-foreground"
          )}>
            {itemCost.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">puntos</span>
        </div>

        {!canAfford && (
          <p className="text-xs text-red-500 mt-1">
            Te faltan {(itemCost - userPoints).toLocaleString()} puntos
          </p>
        )}
      </CardContent>

      <CardFooter>
        <Button 
          className="w-full" 
          onClick={onRedeem}
          disabled={!canAfford || !isAvailable}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {!isAvailable ? "No disponible" : !canAfford ? "Puntos insuficientes" : "Canjear"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function RedemptionCard({ redemption }: { redemption: Redemption }) {
  const status = statusConfig[redemption.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Item Image */}
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            {redemption.catalogItem?.imageUrl ? (
              <img 
                src={redemption.catalogItem.imageUrl} 
                alt={redemption.catalogItem.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Gift className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">
              {redemption.catalogItem?.name || "Item"}
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-3 w-3 text-amber-500" />
              {redemption.pointsSpent.toLocaleString()} puntos
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(redemption.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Status */}
          <Badge variant="outline" className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        {/* Notes */}
        {redemption.notes && (
          <p className="text-sm text-muted-foreground mt-3 border-t pt-3">
            {redemption.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ItemDetailDialog({ 
  item,
  userPoints,
  open, 
  onClose,
  onConfirmRedeem,
}: { 
  item: CatalogItem | null;
  userPoints: number;
  open: boolean;
  onClose: () => void;
  onConfirmRedeem: () => void;
}) {
  if (!item) return null;

  const category = categoryConfig[item.category as keyof typeof categoryConfig] || categoryConfig.general;
  const CategoryIcon = category.icon;
  const itemCost = item.pointsCost ?? item.cost;
  const canAfford = userPoints >= itemCost;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Gift className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </div>
          <DialogTitle>{item.name}</DialogTitle>
          <Badge variant="outline" className="w-fit">
            <CategoryIcon className={cn("h-3 w-3 mr-1", category.color)} />
            {category.label}
          </Badge>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription className="text-base">
            {item.description}
          </DialogDescription>

          {/* Requirements */}
          {item.requirements && Object.keys(item.requirements).length > 0 && (
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2">Requisitos</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {item.requirements.minLevel && (
                  <li>• Nivel mínimo: {item.requirements.minLevel}</li>
                )}
                {item.requirements.badgeId && (
                  <li>• Badge requerido</li>
                )}
              </ul>
            </div>
          )}

          {/* Stock */}
          {item.stock !== null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              {item.stock > 0 ? `${item.stock} unidades disponibles` : "Agotado"}
            </div>
          )}

          {/* Price */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Costo</span>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">
                  {itemCost.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
              <span className="text-muted-foreground">Tu balance</span>
              <span className={cn(
                "font-medium",
                canAfford ? "text-green-500" : "text-red-500"
              )}>
                {userPoints.toLocaleString()} puntos
              </span>
            </div>
            {!canAfford && (
              <p className="text-sm text-red-500 mt-2">
                Te faltan {(itemCost - userPoints).toLocaleString()} puntos
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onConfirmRedeem} disabled={!canAfford}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Canjear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatalogGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="aspect-video" />
          <CardHeader>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const { items, userPoints, isLoading: loadingCatalog, refetch: refetchCatalog, redeemItem } = useCatalog();
  const { redemptions, isLoading: loadingRedemptions, refetch: refetchRedemptions } = useRedemptions();
  const { balance: balanceData } = useRewardsBalance();

  const effectiveUserPoints = balanceData?.totalPoints ?? userPoints;

  // Filter items
  const filteredItems = items.filter((item: CatalogItem) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Separate featured
  const featuredItems = filteredItems.filter((item: CatalogItem) => item.isFeatured);
  const regularItems = filteredItems.filter((item: CatalogItem) => !item.isFeatured);

  const handleItemClick = (item: CatalogItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleConfirmRedeem = () => {
    setDetailOpen(false);
    setConfirmOpen(true);
  };

  const handleRedeem = async () => {
    if (!selectedItem) return;
    
    setRedeeming(true);
    try {
      // Aquí iría la llamada a la API para canjear
      // await redeemItem(selectedItem.id);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simular
      refetchCatalog();
      refetchRedemptions();
      setConfirmOpen(false);
      setSelectedItem(null);
    } catch (error) {
      console.error("Error redeeming item:", error);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tu balance de puntos</p>
              <div className="flex items-center gap-2 mt-1">
                <Star className="h-8 w-8 text-amber-500" />
                <span className="text-4xl font-bold">{userPoints.toLocaleString()}</span>
              </div>
            </div>
            <Gift className="h-16 w-16 text-amber-500/20" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">
            <Gift className="h-4 w-4 mr-2" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="redemptions">
            <Package className="h-4 w-4 mr-2" />
            Mis Canjes ({redemptions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar recompensas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingCatalog ? (
            <CatalogGridSkeleton />
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No se encontraron recompensas</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Featured Items */}
              {featuredItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-500" />
                    Destacados
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {featuredItems.map((item) => (
                      <CatalogItemCard
                        key={item.id}
                        item={item}
                        userPoints={userPoints}
                        onRedeem={() => handleItemClick(item)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Items */}
              {regularItems.length > 0 && (
                <div>
                  {featuredItems.length > 0 && (
                    <h3 className="text-lg font-semibold mb-4">Todos los items</h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {regularItems.map((item) => (
                      <CatalogItemCard
                        key={item.id}
                        item={item}
                        userPoints={userPoints}
                        onRedeem={() => handleItemClick(item)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="redemptions">
          {loadingRedemptions ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-16 h-16 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : redemptions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No has canjeado ninguna recompensa</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ¡Explora el catálogo y canjea tu primera recompensa!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {redemptions.map((redemption) => (
                <RedemptionCard key={redemption.id} redemption={redemption} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Item Detail Dialog */}
      <ItemDetailDialog
        item={selectedItem}
        userPoints={userPoints}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onConfirmRedeem={handleConfirmRedeem}
      />

      {/* Confirm Redeem Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar canje</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas canjear <strong>{selectedItem?.name}</strong> por{" "}
              <strong>{(selectedItem?.pointsCost ?? selectedItem?.cost ?? 0).toLocaleString()}</strong> puntos?
              <br /><br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={redeeming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRedeem} disabled={redeeming}>
              {redeeming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar canje
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
