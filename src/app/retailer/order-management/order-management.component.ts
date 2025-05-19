@Component({
selector: 'app-order-management',
templateUrl: './order-management.component.html',
styleUrls: ['./order-management.component.scss']
})
export class OrderManagementComponent implements OnInit {
allOrders: Order[] = [];
filteredOrders: Order[] = [];
isLoading = true;
activeFilter = 'all';
searchTerm = '';
// Order statistics
orderStats = {
total: 0,
pending: 0,
processing: 0,
shipped: 0,
delivered: 0,
cancelled: 0
};
constructor(
private authService: AuthService,
private orderService: OrderService,
private communicationService: CommunicationService,
private router: Router,
private alertController: AlertController,
private loadingController: LoadingController,
private toastController: ToastController,
private modalController: ModalController
) { }
ngOnInit() {
this.loadOrders();
}
loadOrders() {
this.isLoading = true;
this.authService.currentUser$.pipe(
first()
).subscribe(user => {
if (user) {
this.orderService.getRetailerOrders(user.uid).subscribe(orders => {
this.allOrders = orders;
this.calculateOrderStatistics();
this.applyFilters();
this.isLoading = false;
});
} else {
this.isLoading = false;
}
});
}
calculateOrderStatistics() {
this.orderStats.total = this.allOrders.length;
this.orderStats.pending = this.allOrders.filter(o => o.status === 'pending').length;
this.orderStats.processing = this.allOrders.filter(o => o.status === 'processing').length;
this.orderStats.shipped = this.allOrders.filter(o => o.status === 'shipped').length;
this.orderStats.delivered = this.allOrders.filter(o => o.status === 'delivered').length;
this.orderStats.cancelled = this.allOrders.filter(o => o.status === 'cancelled').length;
}
applyFilters() {
// Apply status filter
let filtered = this.allOrders;
if (this.activeFilter !== 'all') {
filtered = filtered.filter(order => order.status === this.activeFilter);
}
// Apply search filter if there is a search term
if (this.searchTerm && this.searchTerm.trim() !== '') {
  const term = this.searchTerm.toLowerCase();
  filtered = filtered.filter(order => 
    order.id.toLowerCase().includes(term) ||
    order.customerName.toLowerCase().includes(term) ||
    (order.purchaseOrder && order.purchaseOrder.toLowerCase().includes(term))
  );
}

this.filteredOrders = filtered;
}
filterOrders(event: any) {
this.activeFilter = event.detail.value;
this.applyFilters();
}
searchOrders() {
this.applyFilters();
}
refreshOrders(event?: any) {
this.loadOrders();
if (event) {
event.target.complete();
}
}
viewOrderDetails(orderId: string) {
this.router.navigate(['/retailer/orders', orderId]);
}
async updateOrderStatus(order: Order) {
const alert = await this.alertController.create({
header: 'Update Order Status',
inputs: [
{
name: 'status',
type: 'radio',
label: 'Pending',
value: 'pending',
checked: order.status === 'pending'
},
{
name: 'status',
type: 'radio',
label: 'Processing',
value: 'processing',
checked: order.status === 'processing'
},
{
name: 'status',
type: 'radio',
label: 'Shipped',
value: 'shipped',
checked: order.status === 'shipped'
},
{
name: 'status',
type: 'radio',
label: 'Delivered',
value: 'delivered',
checked: order.status === 'delivered'
},
{
name: 'status',
type: 'radio',
label: 'Cancelled',
value: 'cancelled',
checked: order.status === 'cancelled'
}
],
buttons: [
{
text: 'Cancel',
role: 'cancel'
},
{
text: 'Next',
handler: async (data) => {
if (data === order.status) {
const toast = await this.toastController.create({
message: 'Order status is already ' + data,
duration: 2000,
color: 'warning'
});
toast.present();
return;
}
        // Ask for update message
        const messageAlert = await this.alertController.create({
          header: 'Update Message',
          message: 'Please provide a message for this status update:',
          inputs: [
            {
              name: 'message',
              type: 'textarea',
              placeholder: 'e.g., Your order has been shipped via UPS. Tracking #123456'
            }
          ],
          buttons: [
            {
              text: 'Back',
              role: 'cancel'
            },
            {
              text: 'Update',
              handler: async (messageData) => {
                if (!messageData.message) {
                  const toast = await this.toastController.create({
                    message: 'Please provide an update message',
                    duration: 2000,
                    color: 'danger'
                  });
                  toast.present();
                  return false;
                }
                
                this.processOrderUpdate(order, data, messageData.message);
              }
            }
          ]
        });
        await messageAlert.present();
      }
    }
  ]
});
await alert.present();
}
async processOrderUpdate(order: Order, newStatus: Order['status'], message: string) {
const loading = await this.loadingController.create({
message: 'Updating order...',
spinner: 'crescent'
});
await loading.present();
try {
  await this.orderService.updateOrderStatus(order, newStatus, message);
  
  await loading.dismiss();
  
  const toast = await this.toastController.create({
    message: 'Order updated successfully',
    duration: 2000,
    color: 'success'
  });
  toast.present();
  
  // Create notification for customer
  this.communicationService.createOrderStatusNotification(
    order.customerId,
    order.id,
    newStatus,
    message
  ).subscribe();
  
} catch (error) {
  await loading.dismiss();
  
  const toast = await this.toastController.create({
    message: error.message || 'Failed to update order',
    duration: 3000,
    color: 'danger'
  });
  toast.present();
}
}
async cancelOrder(order: Order) {
const alert = await this.alertController.create({
header: 'Cancel Order',
message: 'Please provide a reason for cancellation:',
inputs: [
{
name: 'reason',
type: 'textarea',
placeholder: 'e.g., Items out of stock, order placed in error'
}
],
buttons: [
{
text: 'Back',
role: 'cancel'
},
{
text: 'Confirm',
handler: async (data) => {
if (!data.reason) {
const toast = await this.toastController.create({
message: 'Please provide a cancellation reason',
duration: 2000,
color: 'danger'
});
toast.present();
return false;
}
        this.processOrderUpdate(order, 'cancelled', data.reason);
      }
    }
  ]
});
await alert.present();
}
communicateWithCustomer(order: Order) {
// Navigate to the chat with this customer
this.router.navigate(['/communication/chat', order.customerId]);
}
formatDate(date: any): string {
if (!date) return '';
const d = new Date(date.seconds ? date.seconds * 1000 : date);
return d.toLocaleDateString();
}
getStatusColor(status: string): string {
switch (status) {
case 'pending':
return 'warning';
case 'processing':
return 'primary';
case 'shipped':
return 'tertiary';
case 'delivered':
return 'success';
case 'cancelled':
return 'danger';
default:
return 'medium';
}
}
async exportOrders() {
// Export orders as CSV
const csvContent = this.generateOrdersCSV();
this.downloadCSV(csvContent, 'orders-export.csv');
const toast = await this.toastController.create({
  message: 'Orders exported successfully',
  duration: 2000,
  color: 'success'
});
toast.present();
}
generateOrdersCSV(): string {
const headers = ['Order ID', 'Customer', 'Status', 'Date', 'PO Number'];
const rows = this.filteredOrders.map(order => {
  const date = this.formatDate(order.createdAt);
  return [
    order.id,
    order.customerName,
    order.status.toUpperCase(),
    date,
    order.purchaseOrder || 'N/A'
  ];
});

// Add headers
let csvContent = headers.join(',') + '\n';

// Add rows
rows.forEach(row => {
  // Escape any commas in the data
  const escapedRow = row.map(cell => {
    if (cell.includes(',')) {
      return `"${cell}"`;
    }
    return cell;
  });
  
  csvContent += escapedRow.join(',') + '\n';
});

return csvContent;
}
downloadCSV(csvContent: string, filename: string) {
const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.setAttribute('href', url);
link.setAttribute('download', filename);
link.style.visibility = 'hidden';

document.body.appendChild(link);
link.click();
document.body.removeChild(link);
}
refreshOrderStatistics() {
this.calculateOrderStatistics();
this.presentStatisticsAlert();
}
async presentStatisticsAlert() {
const alert = await this.alertController.create({
header: 'Order Statistics',
message:         Total Orders: ${this.orderStats.total}<br>         Pending: ${this.orderStats.pending}<br>         Processing: ${this.orderStats.processing}<br>         Shipped: ${this.orderStats.shipped}<br>         Delivered: ${this.orderStats.delivered}<br>         Cancelled: ${this.orderStats.cancelled}      ,
buttons: ['OK']
});
await alert.present();
}
viewOrderAnalytics() {
// In a real application, this would navigate to a detailed analytics page
this.router.navigate(['/retailer/analytics']);
}
}