#!/bin/bash

# exit if a command returns a non-zero exit code and also print the commands and their args as they are executed
set -e -x

curl -fsSL https://get.pulumi.com | sh

# Add the pulumi CLI to the PATH
export PATH=$PATH:$HOME/.pulumi/bin

# commented out for release pipeline
pushd /

npm install

pulumi stack select $STACK

pulumi up --yes

# Save the stack output variables to job variables.
# Note: Before the `pulumi up` is run for the first time, there are no stack output variables.
# The pulumi program exports three values: resourceGroupName, storageAccountName and containerName.
echo "##vso[task.setvariable variable=resourceGroupName;isOutput=true]$(pulumi stack output resourceGroupName)"
echo "##vso[task.setvariable variable=clientAppServiceName;isOutput=true]$(pulumi stack output clientAppServiceName)"
echo "##vso[task.setvariable variable=backendAppServiceName;isOutput=true]$(pulumi stack output backendAppServiceName)"

popd