pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IUniswapV2Router02.sol";

contract SwapAgent {

  IUniswapV2Router02 public router;

  constructor(address _router) public {
    router = IUniswapV2Router02(_router);
  }

  function() external payable {}

  function getAmountsOut(
    uint tokenAmountIn,
    IERC20 fromToken,
    IERC20 toToken
  ) public view returns (uint tokenAmountOut) {

    address[] memory path = new address[](2);
    path[0] = address(fromToken);
    path[1] = address(toToken);

    uint[] memory amountsOut = router.getAmountsOut(tokenAmountIn, path);

    return amountsOut[1];
  }

  function swapETHForTokens(IERC20 toToken, uint amountIn, uint amountOutMin) external payable {

    require(msg.value == amountIn, 'msg.value != amountIn');

    address[] memory path = new address[](2);
    path[0] = router.WETH();
    path[1] = address(toToken);

    router.swapExactETHForTokens.value(amountIn)(amountOutMin, path, msg.sender, block.timestamp);
    uint amountOut = toToken.balanceOf(address(this));

    require(toToken.transfer(msg.sender, amountOut), 'Token transfer failed');
  }

  function swapTokensForETH(IERC20 fromToken, uint amountIn, uint amountOutMin) external {

    address[] memory path = new address[](2);
    path[0] = address(fromToken);
    path[1] = router.WETH();

    require(fromToken.transferFrom(msg.sender, address(this), amountIn), 'Token transfer failed');
    require(fromToken.approve(address(router), amountIn), 'Approve failed');

    router.swapExactTokensForETH(amountIn, amountOutMin, path, msg.sender, block.timestamp);
    uint amountOut = address(this).balance;

    (bool success,) = msg.sender.call.value(amountOut)("");
    require(success, "Ether transfer failed");
  }

}
