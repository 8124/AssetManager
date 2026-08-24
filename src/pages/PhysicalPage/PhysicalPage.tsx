import { useState, useMemo } from 'react';

import { Plus, Package } from 'lucide-react';

import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import PhysicalStatSection from './PhysicalStatSection';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AppHeader from '@/components/AppHeader';
import PhysicalFormDialog from './PhysicalFormDialog';
import PhysicalListDialog from './PhysicalListDialog';
import ItemIcon from './ItemIcon';
import {
  usePhysicalItems,
  calcCostPerDay,
  calcHeldDays,
type IPhysicalItem,
} from '@/data/physical';
import { useExchangeRate } from '@/data/asset';


/** 卡片图标背景色（iOS 风格柔和色） */
const ICON_BG_COLORS = [
'#007AFF20',
'#34C75920',
'#FF950020',
'#AF52DE20',
'#FF3B3020',
'#FFCC0020',
'#5AC8FA20',
'#FF648220',
'#7B68EE20',
'#20B2AA20',
];


const ICON_COLORS = [
'#007AFF',
'#34C759',
'#FF9500',
'#AF52DE',
'#FF3B30',
'#FFCC00',
'#5AC8FA',
'#FF6482',
'#7B68EE',
'#20B2AA',
];


export default function PhysicalPage() {
const { rateInfo, fetchRate } = useExchangeRate();
const { items, addItem, updateItem, deleteItem } = usePhysicalItems();
const [formOpen, setFormOpen] = useState(false);
const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
const [editingItem, setEditingItem] = useState<IPhysicalItem | null>(null);
const [deleteTarget, setDeleteTarget] = useState<IPhysicalItem | null>(null);
const [listOpen, setListOpen] = useState(false);


// 按持有成本/天从高到低排序
const sortedItems = useMemo(() => {
return [...items].sort((a, b) => {
const costA = calcCostPerDay(a.price, a.purchaseDate);
const costB = calcCostPerDay(b.price, b.purchaseDate);
return costB - costA;
    });
  }, [items]);

// ==========新增统计计算==========
const stats = useMemo(() => {
  const totalCount = items.length;
  const totalValue = items.reduce((sum, item) => sum + item.price, 0);
  const totalDailyCost = items.reduce((sum, item) => sum + calcCostPerDay(item.price, item.purchaseDate), 0);
  return {
    totalCount,
    totalValue,
    totalDailyCost
  };
}, [items]);


const handleAddClick = () => {
setFormMode('add');
setEditingItem(null);
setFormOpen(true);
  };


const handleCardClick = (item: IPhysicalItem) => {
setFormMode('edit');
setEditingItem(item);
setFormOpen(true);
  };


const handleFormSubmit = (data: Omit<IPhysicalItem, 'id' | 'createdAt'>) => {
if (formMode === 'edit' && editingItem) {
updateItem(editingItem.id, data);
    } else {
addItem(data);
    }
  };


const handleDeleteFromDialog = (id: string) => {
deleteItem(id);
  };


const handleConfirmDelete = () => {
if (deleteTarget) {
deleteItem(deleteTarget.id);
toast.success('物品已删除');
setDeleteTarget(null);
    }
  };


return (
<div className="bg-[#F2F2F7]">
{/* 公共顶部导航栏 */}
<AppHeader
rate={rateInfo.rate}
updatedAt={rateInfo.updatedAt}
onFetchRate={fetchRate}
/>


<main className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-6 pb-24">
{/* 页面标题区 */}
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
<div>
<h2 className="text-lg font-semibold text-foreground">实物</h2>
<p className="text-xs text-muted-foreground mt-0.5">
              建议记录¥500以上的物品
</p>
</div>
<Button
size="sm"
className="w-auto self-start bg-[#007AFF] hover:bg-[#0066CC] 
            shadow-sm"
onClick={handleAddClick}
>
<Plus className="size-3.5 mr-1.5" />
            新增物品
</Button>
</div>

<div>
{items.length > 0 && (
  <PhysicalStatSection
    itemCount={items.length}
    totalValue={stats.totalValue}
    dailyTotalCost={stats.totalDailyCost}
    onItemCountClick={() => setListOpen(true)}
  />
)}

</div>
{items.length === 0 ? (
<div className="flex flex-col items-center justify-center py-16 text-center">
<div className="size-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
<Package className="size-8 text-muted-foreground" />
</div>
<p className="text-base font-medium text-foreground mb-1">暂无实物</p>
<p className="text-sm text-muted-foreground mb-4">
              添加你的第一个物品，看看每天持有成本
</p>
</div>
        ) : (
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
{sortedItems.map((item, index) => {
const costPerDay = calcCostPerDay(item.price, item.purchaseDate);
const heldDays = calcHeldDays(item.purchaseDate);
const bgColor = ICON_BG_COLORS[index % ICON_BG_COLORS.length];
const iconColor = ICON_COLORS[index % ICON_COLORS.length];


return (
<Card
key={item.id}
className="border-0 bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer overflow-hidden"
onClick={() => handleCardClick(item)}
>
<CardContent className="p-3 md:p-4">
<div className="flex flex-col items-center text-center">
{/* 顶部圆形图标 */}
<ItemIcon
icon={item.icon}
size={56}
bgColor={bgColor}
iconColor={iconColor}
/>


{/* 名称 */}
<div
className="mt-3 text-[15px] font-semibold text-foreground w-full truncate"
title={item.name}
>
{item.name}
</div>


{/* 购买日期 */}
<div className="mt-0.5 text-xs text-muted-foreground">
{item.purchaseDate} 购入
</div>


{/* 持有天数 */}
<div className="text-xs text-muted-foreground">
                        已持有 {heldDays} 天
</div>


{/* 每日成本 */}
<div className="mt-2 w-full">
<span className="text-xl md:text-2xl font-bold tabular-nums text-foreground">
                          ¥{costPerDay.toFixed(2)}
</span>
<span className="text-xs text-muted-foreground ml-0.5">
                          /天
</span>
</div>
</div>
</CardContent>
</Card>
              );
            })}
</div>
        )}
</main>


<PhysicalFormDialog
open={formOpen}
mode={formMode}
editingItem={editingItem}
onOpenChange={setFormOpen}
onSubmit={handleFormSubmit}
onDelete={handleDeleteFromDialog}
/>

<PhysicalListDialog
open={listOpen}
onOpenChange={setListOpen}
items={items}
onEdit={handleCardClick}
onDelete={deleteItem}
/>


<AlertDialog
open={!!deleteTarget}
onOpenChange={(open) => !open && setDeleteTarget(null)}
>
<AlertDialogContent>
<AlertDialogHeader>
<AlertDialogTitle>确认删除</AlertDialogTitle>
<AlertDialogDescription>
              确定要删除「{deleteTarget?.name}」吗？此操作不可撤销。
</AlertDialogDescription>
</AlertDialogHeader>
<AlertDialogFooter>
<AlertDialogCancel>取消</AlertDialogCancel>
<AlertDialogAction
onClick={handleConfirmDelete}
className="bg-[#FF3B30] hover:bg-[#D70015] text-white"
>
              删除
</AlertDialogAction>
</AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
</div>
  );
}