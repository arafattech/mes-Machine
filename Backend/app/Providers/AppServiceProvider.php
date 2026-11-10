<?php

namespace App\Providers;

use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\App;
use Flat3\Lodata\Facades\Lodata;
use App\Models\User;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Machine;
use App\Models\MachineAssignment;
use App\Models\MachineSensorData;
use App\Models\Material;
use App\Models\Operation;
use App\Models\Product;
use App\Models\ProductionLine;
use App\Models\QualityInspection;
use App\Models\WorkOrder;
use App\Models\WorkOrderRouting;
use App\Models\ProductionLot;
use App\Models\ProductionLotCount;
use App\Models\ProductionLotItem;
use App\Models\Plant;
use App\Models\Item;
use App\Models\StorageLocation;
use App\Models\Capacity;
use App\Models\Client;
use App\Models\Supplier;
use App\Models\HandlingUnit;
use App\Models\Permission;
use App\Models\Role;
use App\Models\ActivityLog;
use App\Models\LoginActivity;
use App\Models\Notification;
use App\Observers\DepartmentObserver;
use App\Observers\ProductionDataObserver;
use App\Models\MachineWastageEntry;
use App\Models\MachineWastageAllocation;
use App\Models\ClientNote;
use App\Models\ClientArea;
use App\Models\Asset;
use App\Models\Hall;
use App\Models\MachineGroup;
use App\Models\MachineState;
use App\Models\MachineWastageType;
use App\Models\ProductType;
use App\Models\OperationPosition;
use App\Models\AssetGroup;
use App\Models\Department;
use App\Models\Designation;
use App\Models\EmployeeBankInfo;
use App\Models\EmployeeSalary;
use App\Models\ItemCategory;
use App\Models\CountType;
use App\Models\ItemSubCategory;
use App\Models\SupplierBankInfo;
use App\Models\Uom;
use App\Models\Origin;
use App\Models\Variant;
use App\Models\ProductHasvariant;
use App\Models\EmployeeHasAsset;
use App\Models\EmployeeGroup;
use App\Models\EmployeeSection;
use App\Models\EmployeeType;
use App\Models\ApprovalType;

// =========== Production Module ===========
use App\Models\MachineHasConfig;
use App\Models\ConfigHasChannel;
use App\Models\MachineStateEvent;
use App\Models\MachineProductionCount;
use App\Models\MachineProductionTarget;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }
    public function boot(): void
    {
        $isOdataRequest = request()->is(config('lodata.prefix') . "/*") || request()->is(config('lodata.prefix'));

        if (!App::runningInConsole()) {
            Lodata::discover(User::class);
            Lodata::discover(Employee::class);
            Lodata::discover(Machine::class);
            Lodata::discover(MachineAssignment::class);
            Lodata::discover(MachineSensorData::class);
            Lodata::discover(Material::class);
            Lodata::discover(Operation::class);
            Lodata::discover(ProductionLine::class);
            Lodata::discover(QualityInspection::class);
            Lodata::discover(WorkOrder::class);
            Lodata::getEntitySet('WorkOrders')->discoverRelationship('product');
            Lodata::getEntitySet('WorkOrders')->discoverRelationship('machines');
            Lodata::discover(WorkOrderRouting::class);
            Lodata::discover(ProductionLot::class);
            Lodata::getEntitySet('ProductionLots')->discoverRelationship('workOrder');
            Lodata::getEntitySet('ProductionLots')->discoverRelationship('machine');
            Lodata::getEntitySet('ProductionLots')->discoverRelationship('hall');
            Lodata::getEntitySet('ProductionLots')->discoverRelationship('shift');
            Lodata::getEntitySet('ProductionLots')->discoverRelationship('operator');
            Lodata::getEntitySet('ProductionLots')->discoverRelationship('createdBy');
            Lodata::getEntitySet('ProductionLots')->discoverRelationship('counts');
            Lodata::discover(ProductionLotCount::class);
            Lodata::getEntitySet('ProductionLotCounts')->discoverRelationship('productionLot');
            Lodata::getEntitySet('ProductionLotCounts')->discoverRelationship('countType');
            Lodata::getEntitySet('ProductionLotCounts')->discoverRelationship('product');
            Lodata::getEntitySet('ProductionLotCounts')->discoverRelationship('items');
            Lodata::discover(ProductionLotItem::class);
            Lodata::discover(Plant::class);
            Lodata::discover(Item::class);
            Lodata::discover(StorageLocation::class);
            Lodata::discover(Capacity::class);
            Lodata::discover(Client::class);
            Lodata::discover(Supplier::class);
            Lodata::discover(HandlingUnit::class);
            Lodata::discover(Permission::class);
            Lodata::discover(Role::class);
            Lodata::discover(ActivityLog::class);
            Lodata::discover(LoginActivity::class);
            Lodata::discover(ProductType::class);
            Lodata::discover(ItemCategory::class);
            Lodata::discover(CountType::class);
            Lodata::discover(ItemSubCategory::class);
            Lodata::discover(Product::class);
            Lodata::discover(Hall::class);
            Lodata::discover(MachineGroup::class);
            Lodata::discover(MachineState::class);
            Lodata::discover(MachineWastageType::class);
            Lodata::discover(OperationPosition::class);
            Lodata::discover(Asset::class);
            Lodata::discover(AssetGroup::class);
            Lodata::discover(ClientArea::class);
            Lodata::discover(ClientNote::class);
            Lodata::discover(Media::class);
            Lodata::discover(SupplierBankInfo::class);
            Lodata::discover(Uom::class);
            Lodata::discover(Origin::class);
            Lodata::discover(Variant::class);
            Lodata::discover(ProductHasvariant::class);
            Lodata::discover(Department::class);
            Lodata::discover(Designation::class);
            Lodata::discover(EmployeeType::class);
            Lodata::discover(EmployeeSection::class);
            Lodata::discover(MachineHasConfig::class);
            Lodata::discover(ConfigHasChannel::class);
            Lodata::discover(MachineStateEvent::class);
            Lodata::discover(MachineProductionCount::class);
            Lodata::getEntitySet('MachineProductionCounts')->discoverRelationship('machine');
            Lodata::getEntitySet('MachineProductionCounts')->discoverRelationship('workOrder');
            Lodata::getEntitySet('MachineProductionCounts')->discoverRelationship('shift');
            Lodata::discover(MachineProductionTarget::class);
            Lodata::getEntitySet('MachineProductionTargets')->discoverRelationship('machine');
            Lodata::getEntitySet('MachineProductionTargets')->discoverRelationship('workOrder');
            Lodata::getEntitySet('MachineProductionTargets')->discoverRelationship('shift');
            Lodata::getEntitySet('MachineHasConfigs')->discoverRelationship('channels');
            Lodata::getEntitySet('ActivityLogs')->discoverRelationship('user');
            Lodata::getEntitySet('Roles')->discoverRelationship('syncPermissions');
            Lodata::getEntitySet('Products')->discoverRelationship('suppliers');
            Lodata::getEntitySet('Products')->discoverRelationship('clients');
            Lodata::getEntitySet('Products')->discoverRelationship('productTypes');
            Lodata::getEntitySet('Products')->discoverRelationship('itemSubCategories');
            Lodata::getEntitySet('Products')->discoverRelationship('plants');
            Lodata::getEntitySet('Products')->discoverRelationship('uom');
            Lodata::getEntitySet('Products')->discoverRelationship('variants');
            Lodata::getEntitySet('Machines')->discoverRelationship('states');
            Lodata::getEntitySet('Machines')->discoverRelationship('stateEvents');
            Lodata::getEntitySet('Machines')->discoverRelationship('machinehalls');
            Lodata::getEntitySet('Machines')->discoverRelationship('machinewastagetypes');
            Lodata::getEntitySet('MachineWastageTypes')->discoverRelationship('machines');
            Lodata::getEntitySet('Halls')->discoverRelationship('plants');
            Lodata::getEntitySet('Clients')->discoverRelationship('areas');
            Lodata::getEntitySet('Clients')->discoverRelationship('notes');
            Lodata::getEntitySet('Operations')->discoverRelationship('products');
            Lodata::getEntitySet('OperationPositions')->discoverRelationship('products');
            Lodata::getEntitySet('OperationPositions')->discoverRelationship('machines');
            Lodata::getEntitySet('Machines')->discoverRelationship('machinegroups');
            Lodata::getEntitySet('Employees')->discoverRelationship('media');
            Lodata::getEntitySet('Suppliers')->discoverRelationship('bankInfos');
            Lodata::getEntitySet('Suppliers')->discoverRelationship('origin');
            Lodata::getEntitySet('SupplierBankInfos')->discoverRelationship('supplier');
            Lodata::getEntitySet('SupplierBankInfos')->discoverRelationship('createdBy');
            Lodata::getEntitySet('SupplierBankInfos')->discoverRelationship('user');
            Lodata::getEntitySet('Users')->discoverRelationship('media');
            Lodata::getEntitySet('Products')->discoverRelationship('media');
            Lodata::getEntitySet('ItemCategories')->discoverRelationship('subcategories');
            Lodata::getEntitySet('ItemSubCategories')->discoverRelationship('category');
            Lodata::getEntitySet('Suppliers')->discoverRelationship('supplierBanks');
            Lodata::getEntitySet('Suppliers')->discoverRelationship('supplierCash');
            Lodata::getEntitySet('Users')->discoverRelationship('employee');
            Lodata::getEntitySet('Employees')->discoverRelationship('supervisor');
            Lodata::getEntitySet('Employees')->discoverRelationship('subordinates');
            Lodata::getEntitySet('Employees')->discoverRelationship('department');
            Lodata::getEntitySet('Employees')->discoverRelationship('designation');
            Lodata::getEntitySet('Employees')->discoverRelationship('employeeType');
            Lodata::getEntitySet('Employees')->discoverRelationship('employeeSection');

            Lodata::discover(EmployeeShift::class);
            Lodata::discover(EmployeeSalary::class);
            Lodata::discover(EmployeeHasAsset::class);
            Lodata::discover(EmployeeGroup::class);
            Lodata::getEntitySet('EmployeeGroups')->discoverRelationship('shift');
            Lodata::discover(EmployeeBankInfo::class);
            Lodata::getEntitySet('Employees')->discoverRelationship('salary');
            Lodata::getEntitySet('Employees')->discoverRelationship('assets');
            Lodata::getEntitySet('Assets')->discoverRelationship('employees');
            Lodata::getEntitySet('Assets')->discoverRelationship('employeeHasAssets');
            Lodata::getEntitySet('EmployeeHasAssets')->discoverRelationship('employee');
            Lodata::getEntitySet('Employees')->discoverRelationship('employeeHasAssets');
            Lodata::getEntitySet('EmployeeHasAssets')->discoverRelationship('asset');
            Lodata::getEntitySet('Employees')->discoverRelationship('shift');

            Lodata::getEntitySet('EmployeeGroups')->discoverRelationship('employees');

            // ============= Notifications ==============
            Lodata::discover(Notification::class);
            Lodata::getEntitySet('Notifications')->discoverRelationship('recipient');
            Lodata::getEntitySet('Notifications')->discoverRelationship('sender');

            Lodata::discover(ApprovalType::class);
        }

        Department::observe(DepartmentObserver::class);

        // Realtime production / wastage / OEE signal to node-server (Redis pub/sub → socket push).
        foreach ([
            MachineProductionCount::class,
            MachineWastageEntry::class,
            MachineWastageAllocation::class,
            MachineProductionTarget::class,
            MachineHasConfig::class,
            WorkOrder::class,
        ] as $productionModel) {
            $productionModel::observe(ProductionDataObserver::class);
        }
    }
}
