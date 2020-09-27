import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as random from "@pulumi/random";

// use first 10 characters of the stackname as prefix for resource names
const prefix = pulumi.getStack().substring(0, 9);

const globalName = `${prefix}-azure-thesis`;

// Create an Azure Resource Group with prefix e.g. dev-azure-thesis
const resourceGroup = new azure.core.ResourceGroup(globalName, {
  name: globalName,
  location: "NorthEurope",
});
const resourceGroupName = resourceGroup.name;

// Get azure config
// https://www.pulumi.com/blog/7-ways-to-deal-with-application-secrets-in-azure/
const clientConfig = azure.core.getClientConfig({ async: true });
const tenantId = clientConfig.then((config) => config.tenantId);
const currentPrincipal = clientConfig.then((config) => config.objectId);

// Keyvalt for saving secrets
// https://www.pulumi.com/blog/7-ways-to-deal-with-application-secrets-in-azure/
const vault = new azure.keyvault.KeyVault(globalName, {
  name: globalName,
  resourceGroupName: resourceGroup.name,
  skuName: "standard",
  tenantId: tenantId,
  accessPolicies: [
    {
      tenantId,
      // The current principal has to be granted permissions to Key Vault so that it can actually add and then remove
      // secrets to/from the Key Vault. Otherwise, 'pulumi up' and 'pulumi destroy' operations will fail.
      objectId: currentPrincipal,
      secretPermissions: ["delete", "get", "list", "set"],
    },
  ],
});

// Create admin password with random generator
const adminPassword = new random.RandomPassword("password", {
  length: 24,
  special: true,
}).result;
const adminUsername = "sqladmin";

// Create SQL server
const sqlServer = new azure.sql.SqlServer(globalName, {
  name: globalName,
  resourceGroupName: resourceGroup.name,
  // The login and password are required but won't be used in our application
  administratorLogin: adminUsername,
  administratorLoginPassword: adminPassword,
  version: "12.0",
});

const db = new azure.sql.Database(globalName, {
  name: globalName,
  resourceGroupName: resourceGroup.name,
  serverName: sqlServer.name,
  edition: "Free",
});

// Add new secrets for sql server admin
const adminUsernameSecret = new azure.keyvault.Secret("sqlAdminUsername", {
  name: "sqlAdminUsername",
  keyVaultId: vault.id,
  value: adminUsername,
});

const adminPasswordSecret = new azure.keyvault.Secret("sqlAdminPassword", {
  name: "sqlAdminPassword",
  keyVaultId: vault.id,
  value: adminPassword,
});

const appServicePlan = new azure.appservice.Plan(globalName, {
  name: globalName,
  resourceGroupName: resourceGroup.name,
  kind: "Linux",
  reserved: true,
  location: "NorthEurope",
  sku: {
    tier: "Free",
    size: "F1",
  },
});

const appServicePlanId = appServicePlan.id;

const serverAppService = new azure.appservice.AppService(
  `${globalName}-server`,
  {
    name: `${globalName}-server`,
    appServicePlanId,
    resourceGroupName,
  }
);

const clientAppService = new azure.appservice.AppService(
  `${globalName}-client`,
  {
    name: `${globalName}-client`,
    appServicePlanId,
    resourceGroupName,
    appSettings: {
      API_URL: `https://${serverAppService.name}.azurewebsites.net`,
    },
  }
);

export {};
