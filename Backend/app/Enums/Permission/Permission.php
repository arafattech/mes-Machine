<?php

namespace App\Enums\Permission;

enum Permission: string
{
    // Data Management
    case BASE_DATA = 'base-data-management';
    case PRODUCT_MGMT = 'product-management';
    case EMPLOYEE_MGMT = 'employee-management';
    case MACHINE_MGMT = 'machine-management';
    case PLANT_MGMT = 'plant-management';
    case CRUD_PERM = 'crud-permission';

    // Department
    case DEPARTMENT = 'department-management';

    // Variant Management
    case VARIANT_MGMT = 'variant-management';
    case ITEM_VARIANTS = 'item-variants';
    case VARIANT_TYPE = 'variant-type';
    case ITEM_TYPE = 'item-type';

    // Category Management
    case CATEGORY_MGMT = 'category-management';
    case ITEM_CATEGORIES = 'item-categories';
    case ITEM_SUBCATEGORIES = 'item-subcategories';

    // Work Order
    case WORK_ORDER_MGMT = 'work-order-management';
    case CLIENT_MGMT = 'client-management';
    case SUPPLIER_MGMT = 'supplier-management';
    case SUPPLIER_BANK_DETAILS = 'supplier-bank-details';

    // User Management
    case USER_MGMT = 'user-management';
    case ROLE_PERM = 'role-permission';
    case ACTIVITY_LOG = 'activity-log';
    case ADMIN_POWER = 'administration-power';

    // Operations
    case STORAGE_MGMT = 'storage-management';
    case OPERATION_MGMT = 'operation-management';
    case TOOLS_MGMT = 'tools-management';
    case CAPACITY_MGMT = 'capacity-management';

    // Facility Management
    case HALL_MGMT = 'hall-management';
    case MACHINE_GROUP = 'machine-group';
    case MACHINE_STATE = 'machine-state';

    // Client & Asset
    case CLIENT_NOTE = 'client-note';
    case CLIENT_AREAS = 'client-areas';
    case ASSET_MGMT = 'asset-management';

    // HR & Production
    case PRODUCTION_MGMT = 'production-management';
    case HR_MGMT = 'hr-management';
    case EMP_DASHBOARD = 'employee-dashboard';

    // Sales & Marketing
    case MARKETING_SALES = 'marketing-and-sales';
    case SALES_MGMT = 'sales-management';
    case SALES_ANALYTICS = 'sales-analytics';
    case PRICING_PLAN = 'pricing-plan';
    case SALES_ORDERS = 'sales-orders';
    case SALES_AUDIT = 'sales-audit';
    case EXPIRED_SALES = 'expired-sales-orders';
    case MARKET_PRICES = 'market-price-history';
    case MARKET_PRICE_ENTRY = 'market-price-entry';

    // Others
    case QUALITY_MGMT = 'quality-management';
    case STORE_MGMT = 'store-management';
    case TASK_MGMT = 'task-management';
    case PURCHASE_MGMT = 'purchase-management';
}
